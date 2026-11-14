using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
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
app.Use(async (context, next) =>
{
    if (context.Request.Path == "/health" && context.Request.Method == "GET")
    {
        await next();
        return;
    }

    var expected = Environment.GetEnvironmentVariable("DM4615_AGENT_TOKEN");
    var supplied = context.Request.Headers["X-Agent-Token"].FirstOrDefault();
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

app.MapGet("/health", () => Results.Ok(new
{
    status = "online",
    agent = "dm4615-windows",
    mode = "local",
    oltCommandsEnabled = false
}));

app.MapPost("/olt/connection-test", async (IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var host = Environment.GetEnvironmentVariable("DM4615_SSH_HOST")
        ?? configuration["Olt:Host"]
        ?? "192.168.0.25";
    var portText = Environment.GetEnvironmentVariable("DM4615_SSH_PORT")
        ?? configuration["Olt:Port"]
        ?? "22";
    var username = Environment.GetEnvironmentVariable("DM4615_SSH_USERNAME");
    var password = Environment.GetEnvironmentVariable("DM4615_SSH_PASSWORD");
    var expectedFingerprint = Environment.GetEnvironmentVariable("DM4615_SSH_HOSTKEY_SHA256");

    if (!int.TryParse(portText, out var port) || port is < 1 or > 65535 ||
        string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password) ||
        string.IsNullOrWhiteSpace(expectedFingerprint))
    {
        return Results.Problem(
            "Configure host, porta, usuário, senha e fingerprint SHA-256 no ambiente Windows.",
            statusCode: StatusCodes.Status400BadRequest);
    }

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
        var actual = Convert.ToBase64String(SHA256.HashData(e.HostKey));
        var normalizedExpected = expectedFingerprint.Replace("SHA256:", "", StringComparison.Ordinal).Trim();
        hostKeyAccepted = CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(actual), Encoding.ASCII.GetBytes(normalizedExpected));
        e.CanTrust = hostKeyAccepted;
    };

    try
    {
        await Task.Run(client.Connect, cancellationToken);
        return Results.Ok(new
        {
            connected = client.IsConnected,
            host,
            port,
            hostKeyVerified = hostKeyAccepted,
            commandExecuted = false,
            message = "Handshake SSH concluído. Nenhum comando foi executado."
        });
    }
    catch (Exception ex) when (ex is SshException or SocketException or OperationCanceledException)
    {
        _ = ex;
        return Results.Problem(
            hostKeyAccepted
                ? "Falha ao estabelecer a sessão SSH. Verifique usuário, senha, rede e logs locais."
                : "Conexão recusada: fingerprint SSH não corresponde ao valor fixado.",
            statusCode: StatusCodes.Status502BadGateway);
    }
    finally
    {
        if (client.IsConnected) client.Disconnect();
    }
});

app.MapGet("/capabilities", () => Results.Ok(new
{
    transport = new[] { "ssh" },
    target = "Datacom DM4615",
    supportedNow = new[] { "ssh-handshake" },
    pendingFirmwareValidation = new[]
    {
        "system-inventory", "alarms", "pon-ports", "onu-discovery",
        "optical-levels", "onu-provisioning", "service-profiles"
    },
    writeOperationsEnabled = false
}));

app.Run();
