using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Hosting.WindowsServices;
using Renci.SshNet;
using Renci.SshNet.Common;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService(options => options.ServiceName = "DM4615 Local Agent");

var listenUrl = Environment.GetEnvironmentVariable("DM4615_AGENT_URL")
    ?? builder.Configuration["Agent:ListenUrl"]
    ?? "http://127.0.0.1:17861";

if (!Uri.TryCreate(listenUrl, UriKind.Absolute, out var listenUri) ||
    !IPAddress.TryParse(listenUri.Host, out var listenAddress) ||
    !IPAddress.IsLoopback(listenAddress))
{
    throw new InvalidOperationException("O agente só pode escutar em endereço loopback.");
}

builder.WebHost.UseUrls(listenUrl);
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();
var allowedOrigins = (Environment.GetEnvironmentVariable("DM4615_AGENT_ALLOWED_ORIGINS")
    ?? "https://dm4615.lovable.app;https://id-preview--5048035b-5812-5d98-a874-ee5a764cc22d.lovable.app;http://localhost:3000;http://localhost:5173")
    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
var commandsEnabled = string.Equals(
    Environment.GetEnvironmentVariable("DM4615_ENABLE_READ_COMMANDS"), "true",
    StringComparison.OrdinalIgnoreCase);

// CORS + Chrome Private Network Access. Origins are exact allow-list entries.
app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.FirstOrDefault();
    if (!string.IsNullOrEmpty(origin) && allowedOrigins.Contains(origin, StringComparer.Ordinal))
    {
        context.Response.Headers.AccessControlAllowOrigin = origin;
        context.Response.Headers.AccessControlAllowMethods = "GET,POST,OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders = "Authorization,Content-Type";
        context.Response.Headers.AccessControlMaxAge = "600";
        context.Response.Headers.Append("Vary", "Origin");
        if (context.Request.Headers.ContainsKey("Access-Control-Request-Private-Network"))
            context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
    }

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.Use(async (context, next) =>
{
    if ((context.Request.Path == "/health" || context.Request.Path == "/favicon.ico") && context.Request.Method == "GET")
    {
        await next();
        return;
    }

    var expected = Environment.GetEnvironmentVariable("DM4615_AGENT_TOKEN");
    var supplied = context.Request.Headers.Authorization.FirstOrDefault();
    if (supplied?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true)
        supplied = supplied["Bearer ".Length..].Trim();
    else
        supplied = context.Request.Headers["X-Agent-Token"].FirstOrDefault();

    if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrEmpty(supplied) ||
        !CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(supplied)))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "unauthorized" });
        return;
    }

    await next();
});

app.MapGet("/favicon.ico", () => Results.NoContent());

app.MapGet("/health", () => Results.Ok(new
{
    status = "online",
    agent = "dm4615-windows",
    version = "0.2.0",
    capabilities = commandsEnabled
        ? new[] { "gpon.interface.read", "gpon.onu.read", "cli.read" }
        : Array.Empty<string>(),
    oltCommandsEnabled = commandsEnabled
}));

app.MapPost("/olt/connection-test", async (IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var result = await WithSsh(configuration, async (client, host, port) =>
    {
        await Task.Run(client.Connect, cancellationToken);
        return new
        {
            connected = client.IsConnected,
            host,
            port,
            hostKeyVerified = true,
            commandExecuted = false,
            message = "Handshake SSH concluído. Nenhum comando foi executado."
        };
    }, cancellationToken);

    return result.Success
        ? Results.Ok(result.Value)
        : Results.Problem(result.Error, statusCode: result.StatusCode);
});

app.MapGet("/olt/gpon/interface", async (string pon, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    if (!commandsEnabled) return Results.Problem("Consultas CLI estão desabilitadas. Ative DM4615_ENABLE_READ_COMMANDS=true após validar a CLI.", statusCode: 503);
    if (!IsSupportedPon(pon)) return Results.BadRequest(new { error = "PON inválida. Informe uma interface física entre 1/1/1 e 1/1/16." });
    return await RunReadCommand(configuration, $"show interface gpon {pon}", cancellationToken);
});

app.MapGet("/olt/gpon/onu", async (string pon, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    if (!commandsEnabled) return Results.Problem("Consultas CLI estão desabilitadas. Ative DM4615_ENABLE_READ_COMMANDS=true após validar a CLI.", statusCode: 503);
    if (!IsSupportedPon(pon)) return Results.BadRequest(new { error = "PON inválida. Informe uma interface física entre 1/1/1 e 1/1/16." });
    return await RunReadCommand(configuration, $"show interface gpon {pon} onu", cancellationToken);
});

app.MapPost("/olt/cli/read", async (ReadCommandRequest request, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    if (!commandsEnabled) return Results.Problem("Consultas CLI estão desabilitadas. Ative DM4615_ENABLE_READ_COMMANDS=true após validar a CLI.", statusCode: 503);
    if (!IsAllowedReadCommand(request.Command))
        return Results.BadRequest(new { error = "Comando fora da allowlist dinâmica de leitura GPON." });
    return await RunReadCommand(configuration, request.Command, cancellationToken);
});

app.MapGet("/capabilities", () => Results.Ok(new
{
    transport = new[] { "ssh" },
    target = "Datacom DM4615",
    supportedNow = new[] { "ssh-handshake" },
    pendingFirmwareValidation = new[] { "optical-levels", "onu-distance", "per-onu-traffic", "onu-provisioning" },
    writeOperationsEnabled = false
}));

app.Run();

static bool IsSupportedPon(string pon) => System.Text.RegularExpressions.Regex.IsMatch(pon, @"^1/1/(?:[1-9]|1[0-6])$");

static bool IsAllowedReadCommand(string command) =>
    System.Text.RegularExpressions.Regex.IsMatch(command, @"^show interface gpon 1/1/(?:[1-9]|1[0-6])(?: onu)?$");

static async Task<IResult> RunReadCommand(IConfiguration configuration, string command, CancellationToken cancellationToken)
{
    var result = await WithSsh(configuration, async (client, _, _) =>
    {
        await Task.Run(client.Connect, cancellationToken);
        using var cmd = client.CreateCommand(command);
        cmd.CommandTimeout = TimeSpan.FromSeconds(20);
        var raw = await Task.Run(cmd.Execute, cancellationToken);
        if (!string.IsNullOrWhiteSpace(cmd.Error))
            throw new InvalidOperationException("A OLT retornou erro na consulta: " + cmd.Error.Trim());
        return new { command, collectedAt = DateTimeOffset.UtcNow, raw, parsed = ParseGponOutput(command, raw) };
    }, cancellationToken);

    return result.Success
        ? Results.Ok(result.Value)
        : Results.Problem(result.Error, statusCode: result.StatusCode);
}

static object ParseGponOutput(string command, string raw)
{
    var ponMatch = Regex.Match(command, @"gpon\s+(?<pon>1/1/\d+)", RegexOptions.IgnoreCase);
    var pon = ponMatch.Success ? ponMatch.Groups["pon"].Value : null;

    if (command.EndsWith(" onu", StringComparison.OrdinalIgnoreCase))
    {
        var rows = Regex.Matches(
            raw,
            @"^[ \t]*(?<pon>1/1/\d+)[ \t]+(?<id>\d+)[ \t]+(?<serial>\S+)[ \t]+(?<state>\S+)[ \t]+(?<download>\S+)[ \t]*(?<name>[^\r\n]*?)[ \t]*$",
            RegexOptions.Multiline);

        var onus = rows
            .Select(row => new
            {
                pon = row.Groups["pon"].Value,
                onuId = int.TryParse(row.Groups["id"].Value, out var id) ? id : 0,
                serialNumber = row.Groups["serial"].Value,
                operState = row.Groups["state"].Value,
                softwareDownloadState = row.Groups["download"].Value,
                name = row.Groups["name"].Value.Trim()
            })
            .ToArray();

        return new
        {
            kind = "gpon-onus",
            pon,
            onuCount = onus.Length,
            onus,
            parseStatus = "ok"
        };
    }

    var physical = Regex.Match(
        raw,
        @"Physical interface\s*:\s*gpon\s+(?<pon>1/1/\d+)\s*,\s*(?<admin>[^,]+),\s*Physical link is\s*(?<oper>\S+)",
        RegexOptions.IgnoreCase);

    var overhead = Regex.Match(
        raw,
        @"Overhead\s*:\s*(?<value>\d+)\s+kbit/s\s*\((?<onus>\d+)\s+ONUs?\)",
        RegexOptions.IgnoreCase);

    return new
    {
        kind = "gpon-interface",
        pon = physical.Success ? physical.Groups["pon"].Value : pon,
        adminState = physical.Success ? physical.Groups["admin"].Value.Trim() : null,
        operState = physical.Success ? physical.Groups["oper"].Value.Trim() : null,
        linkLevelType = ReadField(raw, "Link-level type"),
        logicalReach = ReadField(raw, "Logical reach"),
        downstreamFec = ReadField(raw, "Downstream FEC"),
        upstreamFec = ReadField(raw, "Upstream FEC"),
        transceiverType = ReadField(raw, "Transceiver type"),
        allocatedUpstream = new
        {
            maxKbit = ReadLongField(raw, "Max"),
            overheadKbit = overhead.Success && long.TryParse(overhead.Groups["value"].Value, out var overheadValue)
                ? overheadValue : (long?)null
        },
        availableUpstream = new
        {
            cbrKbit = ReadLongField(raw, "CBR BW"),
            totalKbit = ReadLongField(raw, "Total BW")
        },
        onuCount = overhead.Success && int.TryParse(overhead.Groups["onus"].Value, out var onuCount)
            ? onuCount : (int?)null,
        parseStatus = physical.Success ? "ok" : "partial"
    };
}

static string? ReadField(string raw, string label)
{
    var match = Regex.Match(
        raw,
        @"^\s*" + Regex.Escape(label) + @"\s*:\s*(?<value>.*?)\s*$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase);
    return match.Success ? match.Groups["value"].Value.Trim() : null;
}

static long? ReadLongField(string raw, string label)
{
    var value = ReadField(raw, label);
    var match = value is null
        ? Match.Empty
        : Regex.Match(value, @"(?<value>\d+)");
    return match.Success && long.TryParse(match.Groups["value"].Value, out var parsed)
        ? parsed : null;
}

static async Task<SshResult<T>> WithSsh<T>(
    IConfiguration configuration,
    Func<SshClient, string, int, Task<T>> action,
    CancellationToken cancellationToken)
{
    var host = Environment.GetEnvironmentVariable("DM4615_SSH_HOST")
        ?? configuration["Olt:Host"] ?? "192.168.0.25";
    var portText = Environment.GetEnvironmentVariable("DM4615_SSH_PORT")
        ?? configuration["Olt:Port"] ?? "22";
    var username = Environment.GetEnvironmentVariable("DM4615_SSH_USERNAME");
    var password = Environment.GetEnvironmentVariable("DM4615_SSH_PASSWORD");
    var expectedFingerprint = Environment.GetEnvironmentVariable("DM4615_SSH_HOSTKEY_SHA256");

    if (!int.TryParse(portText, out var port) || port is < 1 or > 65535 ||
        string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password) ||
        string.IsNullOrWhiteSpace(expectedFingerprint))
        return SshResult<T>.Fail("Configure host, porta, usuário, senha e fingerprint SHA-256 no ambiente Windows.", 400);

    var timeoutSeconds = int.TryParse(configuration["Olt:ConnectTimeoutSeconds"], out var t)
        ? Math.Clamp(t, 3, 30) : 8;
    var connectionInfo = new Renci.SshNet.ConnectionInfo(
        host, port, username, new PasswordAuthenticationMethod(username, password))
    {
        Timeout = TimeSpan.FromSeconds(timeoutSeconds)
    };
    using var client = new SshClient(connectionInfo);
    var hostKeyAccepted = false;
    client.HostKeyReceived += (_, e) =>
    {
        var actual = Convert.ToBase64String(SHA256.HashData(e.HostKey)).TrimEnd('=');
        var normalizedExpected = expectedFingerprint.Replace("SHA256:", "", StringComparison.Ordinal).Trim().TrimEnd('=');
        hostKeyAccepted = CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(actual), Encoding.ASCII.GetBytes(normalizedExpected));
        e.CanTrust = hostKeyAccepted;
    };

    try
    {
        var value = await action(client, host, port);
        return SshResult<T>.Ok(value);
    }
    catch (Exception ex) when (ex is SshException or SocketException or OperationCanceledException or InvalidOperationException)
    {
        var message = hostKeyAccepted
            ? "Falha na sessão/consulta SSH. Confira credenciais, CLI e logs locais."
            : "Conexão recusada: fingerprint SSH não corresponde ao valor fixado.";
        return SshResult<T>.Fail(message, 502);
    }
    finally
    {
        if (client.IsConnected) client.Disconnect();
    }
}

record ReadCommandRequest(string Command);
record SshResult<T>(bool Success, T? Value, string? Error, int StatusCode)
{
    public static SshResult<T> Ok(T value) => new(true, value, null, 200);
    public static SshResult<T> Fail(string error, int statusCode) => new(false, default, error, statusCode);
}
