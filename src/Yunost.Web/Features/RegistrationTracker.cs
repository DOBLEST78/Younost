using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Yunost.Web.Features;

public sealed class RegistrationTracker
{
    private readonly ConcurrentDictionary<string, Registration> registrations = new();

    private sealed record Registration(
        string UserId,
        DateTimeOffset ExpiresAt
    );

    public string Create(string userId)
    {
        var ticket = Convert.ToHexString(
            RandomNumberGenerator.GetBytes(32)
        );

        registrations[ticket] = new Registration(
            userId,
            DateTimeOffset.UtcNow.AddMinutes(30)
        );

        return ticket;
    }

    public string? GetUserId(string ticket)
    {
        if (!registrations.TryGetValue(ticket, out var registration))
            return null;

        if (registration.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            registrations.TryRemove(ticket, out _);
            return null;
        }

        return registration.UserId;
    }

    public void Remove(string ticket)
    {
        registrations.TryRemove(ticket, out _);
    }
}