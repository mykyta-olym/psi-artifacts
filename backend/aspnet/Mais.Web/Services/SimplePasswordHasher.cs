using System.Security.Cryptography;
using System.Text;

namespace Mais.Web.Services;

public interface ISimplePasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public class SimplePasswordHasher : ISimplePasswordHasher
{
    // PBKDF2 parameters
    private const int Iterations = 100_000;
    private const int SaltSize = 16; // 128-bit
    private const int KeySize = 32;  // 256-bit

    public string Hash(string password)
    {
        using var rng = RandomNumberGenerator.Create();
        var salt = new byte[SaltSize];
        rng.GetBytes(salt);
        var key = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password ?? string.Empty), salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"pbkdf2-sha256:{Iterations}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(key)}";
    }

    public bool Verify(string password, string hash)
    {
        try
        {
            var parts = (hash ?? string.Empty).Split(':');
            if (parts.Length != 4) return false;
            if (!int.TryParse(parts[1], out var iters)) return false;
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var key = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password ?? string.Empty), salt, iters, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(key, expected);
        }
        catch { return false; }
    }
}
