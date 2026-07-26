# Big Sky BodyForge Website v2

This package contains:

- `/index.html` — public client intake form
- `/admin/index.html` — secure owner dashboard
- Existing public styles and submission logic
- Owner login, intake review, notes, consent review, client list, and one-click conversion

## Deploy to Netlify

1. Unzip this package.
2. In Netlify, open the existing site.
3. Go to **Deploys**.
4. Drag the entire `big-sky-bodyforge-site-v2` folder into the manual deploy area.
5. Public form: `https://YOUR-SITE.netlify.app/`
6. Owner dashboard: `https://YOUR-SITE.netlify.app/admin/`

## Owner sign-in

Use the Supabase owner account:

`chancedb42@gmail.com`

The password is the password assigned to that Supabase Auth account. It is not included in these files.

## Workflow

1. Applicant submits public intake.
2. Submission appears under `/admin/`.
3. Owner opens it, reviews disclosures and consents, and optionally saves private review notes.
4. Owner presses **Convert to client**.
5. The existing `convert_intake_to_client` RPC creates the client, goal, and private note.

## Security

- No service-role key is included.
- The browser uses the public Supabase key.
- Owner data access is authorized by Supabase Auth and Row Level Security.
- Anonymous table grants were revoked; the public intake remains available only through the controlled submission RPC.
