# Putting miDepo online

This guide assumes you have never hosted a website. It takes about 45 minutes. At the end, miDepo runs at an address on your own domain, such as `https://midepo.yourdomain.com`, with HTTPS.

> Menu names on these services change from time to time. If a button is not called exactly what this guide says, look for the closest match; the steps and their order stay the same.

## What you are setting up

| Piece | Service | What it does | Cost |
|---|---|---|---|
| The app | [Vercel](https://vercel.com) | Runs miDepo and rebuilds it every time the code changes | Free "Hobby" plan for trying it out. Vercel's terms reserve Hobby for non-commercial use, so plan on the paid "Pro" plan once a client uses it. Check their pricing page for the current figure. |
| The database | [Neon](https://neon.tech) | Stores everything (Postgres) | Free plan is enough to start. |
| The address | Your domain registrar | Points a name at Vercel | Already paid. |

You also need the code on GitHub, which you already have (`jettpistol/miDepo`).

## Before you start

- The miDepo code must be on the branch you want to publish. Vercel publishes the repository's **default branch** (usually `main`). If the code is still on another branch, merge it first.
- Have your domain registrar login to hand.

## Step 1: Create the database (Neon)

1. Go to <https://neon.tech> and sign up. Signing up with your GitHub account is the quickest.
2. Create a project. Name it `midepo`.
3. Choose the region closest to your users. For Argentina, pick **São Paulo** if it is offered.
4. When the project is ready, find **Connect** (or "Connection string").
5. Make sure **Connection pooling** is switched on. The address then contains the word `pooler`.
6. Copy the whole string. It looks like this:

```
postgresql://user:password@ep-something-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

Keep it somewhere private. Anyone with this string can read and change your data.

## Step 2: Generate a secret

miDepo needs a long random text to protect PINs. Any of these works:

- On a Mac or Linux terminal:

```bash
openssl rand -hex 32
```

- Or use a password manager to generate 64 random letters and numbers.

Keep it with the database string. **Never change it later**: every PIN would stop working.

## Step 3: Publish the app (Vercel)

1. Go to <https://vercel.com> and sign up with your GitHub account.
2. Choose **Add New → Project**.
3. Find `miDepo` in the list and press **Import**. If it is not listed, press the link to adjust GitHub permissions and give Vercel access to that repository.
4. Vercel detects that it is a Next.js project. Open **Build and Output Settings** and set **Build Command** to:

```
npm run build:prod
```

This matters: that command creates the database tables before building.

5. Open **Environment Variables** and add these four:

| Name | Value |
|---|---|
| `DATABASE_URL` | The string from step 1 |
| `SECRETO` | The text from step 2 |
| `APP_URL` | `https://midepo.yourdomain.com` (the address you will use, no slash at the end) |
| `DATOS_DEMO` | `si` to load the demo companies, `no` for a clean site |

6. Press **Deploy** and wait two or three minutes.

When it finishes, Vercel gives you an address ending in `.vercel.app`. Open it: you should see the miDepo login page.

> With `DATOS_DEMO=si` the site contains demo users with a publicly known password (`midepo1234`). That is fine for testing. Before real warehouse data goes in, see [Going from test to real use](#going-from-test-to-real-use).

## Step 4: Connect your domain

Use a subdomain such as `midepo.yourdomain.com`. It leaves your main site untouched.

1. In Vercel, open the project and go to **Settings → Domains**.
2. Type `midepo.yourdomain.com` and press **Add**.
3. Vercel shows a DNS record to create. It is normally a **CNAME**:

| Type | Name | Value |
|---|---|---|
| CNAME | `midepo` | The value Vercel shows you (copy it exactly) |

4. In another tab, log in to your domain registrar and find **DNS** (also called "DNS records" or "Zone").
5. Add a record with exactly the type, name and value Vercel showed. Save.
6. Go back to Vercel. Within a few minutes (occasionally a few hours) the domain shows as valid. Vercel sets up HTTPS on its own.

Check that `APP_URL` from step 3 matches this address exactly. If you change it, go to **Deployments**, open the latest one and choose **Redeploy**.

## Step 5: Check it works

1. Open `https://midepo.yourdomain.com`.
2. Log in as `supervisor@ovnipress.test` with `midepo1234` (only if you loaded demo data).
3. Open **Picking** and prepare an order.
4. On your phone, open the same address and log in with company code `ovnipress` and PIN `100001`.
5. On the phone, tap the camera button next to a scan field and allow camera access.

## Going from test to real use

1. In Neon, create a **new, empty** database (or a new project) and copy its connection string.
2. In Vercel, **Settings → Environment Variables**: replace `DATABASE_URL` with the new string and set `DATOS_DEMO` to `no`.
3. Redeploy. The site now has tables and no data.
4. Create the first company and its administrator. This needs Node.js on your computer and the project downloaded. In the project folder, with the **new** database string and your secret:

```bash
DATABASE_URL="postgresql://..." SECRETO="your-secret" npm run empresa:crear -- "Ovnipress" ovnipress you@yourmail.com "a-long-password"
```

5. Log in with that email and password. Under **Usuarios** add the rest of the team; under **Ubicaciones** create the shelf locations.

A new company starts connected to the simulated Fierro with no orders. Real orders need the real Fierro connector, which is not built yet.

## Updating miDepo

Every change pushed to the default branch on GitHub is published automatically in a couple of minutes. Database changes are applied by the same build. There is nothing to do by hand.

If an update breaks something: in Vercel, **Deployments**, find the last one that worked, open its menu and choose **Promote to Production** (or "Rollback").

## Backups

Neon keeps a history of the database and can restore it to an earlier moment. How far back depends on the plan; check **Backup & Restore** in your Neon project. Before any risky change, create a **branch** in Neon: it is a full copy made in seconds.

## If something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| Build fails with "Falta la variable SECRETO" | `SECRETO` not set | Add it under Environment Variables and redeploy. |
| Build fails mentioning the database or a timeout | Wrong `DATABASE_URL` | Copy it again from Neon, with pooling on, and redeploy. |
| Login page loads, logging in gives an error | Tables missing | Check the Build Command is `npm run build:prod`, then redeploy. |
| "Entrar con huella" fails on the real domain | `APP_URL` does not match the address in the browser | Fix `APP_URL` and redeploy. Passkeys registered on the `.vercel.app` address do not work on your domain: register again. |
| Camera does not open | Site opened without HTTPS, or permission denied | Use the `https://` address; allow the camera in the browser's site settings. |
| Domain stays "Invalid configuration" | DNS record mistyped, or still spreading | Compare the record with what Vercel shows. Wait up to a few hours. |
| Site is slow on the first click after a quiet period | The free database goes to sleep when idle | Normal on free plans; it wakes in a second or two. A paid Neon plan keeps it awake. |

## If you would rather use one service

[Railway](https://railway.com) and [Render](https://render.com) can run the app and the database together under one bill. The settings are the same four environment variables, the same build command (`npm run build:prod`) and the start command `npm start`. This guide uses Vercel and Neon because they need the fewest decisions.
