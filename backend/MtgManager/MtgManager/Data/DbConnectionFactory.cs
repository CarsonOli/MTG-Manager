using Npgsql;

namespace MtgManager.Data;

// Creates PostgreSQL connections for repositories and services.
public class DbConnectionFactory
{
    private readonly string connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is missing.");
    }

    public NpgsqlConnection CreateConnection()
    {
        return new NpgsqlConnection(connectionString);
    }
}
