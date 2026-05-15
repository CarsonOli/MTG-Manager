# MTG Manager

Magic: The Gathering Commander deck tracker with React + Vite frontend and ASP.NET backend.

## Local Setup

### Backend

1. Set these values in `backend/MtgManager/MtgManager/appsettings.json` or user secrets/environment variables:
`ConnectionStrings:DefaultConnection`, `Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience`.
2. Run:

```bash
dotnet run --project backend/MtgManager/MtgManager
```

API default URL: `http://localhost:5131`

### Frontend

1. Create `frontend/.env` from `frontend/.env.example`.
2. Run:

```bash
cd frontend
npm install
npm run dev
```

## Deployment

### Render (Backend API)

Use either Blueprint deploy (`render.yaml` at repo root) or manual service config:

- Runtime: `.NET`
- Root Directory: `backend/MtgManager/MtgManager`
- Build Command: `dotnet restore && dotnet publish -c Release -o out`
- Start Command: `dotnet out/MtgManager.dll`

Set these environment variables in Render:

- `ASPNETCORE_ENVIRONMENT=Production`
- `ASPNETCORE_URLS=http://0.0.0.0:$PORT`
- `ConnectionStrings__DefaultConnection=<your-postgres-connection-string>`
- `Jwt__Secret=<long-random-secret-32+-chars>`
- `Jwt__Issuer=MtgManagerApi`
- `Jwt__Audience=MtgManagerClient`
- `Cors__AllowedOrigins__0=<your-vercel-frontend-url>`

Why you saw `Couldn't find a package.json file in "/opt/render/project/src"`:
Render was trying to run a Node build at repo root. Your backend is .NET, so it must use the .NET runtime and backend root directory above.

### Vercel (Frontend)

When creating the Vercel project:

- Framework Preset: `Vite`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Set this environment variable in Vercel:

- `VITE_API_BASE_URL=<your-render-backend-url>`

`frontend/vercel.json` includes an SPA rewrite so deep links resolve to `index.html`.

## Database Notes

- Use `schema (2).sql` to create tables and view.
- Use `seed.sql` to seed lookup records.
- Supabase GitHub integration can use the `supabase/` directory at the repository root.
- When Supabase asks for the relative path to the directory containing your `supabase/` folder, enter `.`.
- `decks` includes `wins` and `losses` columns used by deck statistics.
