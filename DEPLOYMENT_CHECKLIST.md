# Aperture AI - Deployment Checklist

## Pre-Deployment Requirements

### ✅ Google OAuth 2.0 Web Application Setup

Your app is **ready for deployment with Google OAuth**. Here's the complete setup:

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a Project" → "New Project"
3. Name: `Aperture AI` (or your preferred name)
4. Click "Create"

#### Step 2: Enable Google+ API
1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

#### Step 3: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - User Type: **External**
   - App name: `Aperture AI`
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes: `email`, `profile`
   - Add test users if needed
4. Back to Credentials, click "Create Credentials" → "OAuth client ID"
5. Application type: **Web application**
6. Name: `Aperture AI Web Client`
7. **Authorized JavaScript origins:**
   - For development: `http://localhost:5000`
   - For production: `https://yourdomain.com` (replace with your actual domain)
8. **Authorized redirect URIs:**
   - For development: `http://localhost:5000/api/auth/google/callback`
   - For production: `https://yourdomain.com/api/auth/google/callback`
9. Click "Create"
10. Copy the **Client ID** and **Client Secret**

#### Step 4: Configure Environment Variables
Add to your `.env` file:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
BASE_URL=http://localhost:5000  # For development
```

For production, update `BASE_URL`:
```bash
BASE_URL=https://yourdomain.com
```

### ✅ OpenAI API Setup

1. Sign up at [OpenAI Platform](https://platform.openai.com)
2. Go to "API keys" section
3. Create a new secret key
4. Add to `.env`:
```bash
OPENAI_API_KEY=sk-...
```

### ✅ Neon PostgreSQL Database

1. Create account at [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to `.env`:
```bash
DATABASE_URL=postgresql://user:password@host/dbname
```
5. Run migrations:
```bash
npm run db:push
```

### ✅ Session Secret

Generate a secure random string (min 32 characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```bash
SESSION_SECRET=your-generated-secret
```

## Pre-Deployment Verification

### Local Testing Checklist

- [ ] All environment variables are set in `.env`
- [ ] `npm install` completes without errors
- [ ] `npm run check` passes (TypeScript compilation)
- [ ] `npm run db:push` succeeds (database migrations)
- [ ] `npm run dev` starts both client and server
- [ ] Can sign up with local account
- [ ] Can sign in with local account
- [ ] Google OAuth login works (`Sign in with Google` button)
- [ ] Can upload an image
- [ ] Image analysis works (AI suggestions appear)
- [ ] Can generate edits
- [ ] Edit history displays correctly
- [ ] Can update profile/password
- [ ] Dark/light mode toggle works
- [ ] Responsive design works on mobile

### Build Verification

```bash
npm run build
npm run start
# Test the production build locally
```

## Deployment Steps

### Step 1: Choose Hosting Platform

**Recommended Options:**
- **Vercel** - Best for Node.js apps, easy setup, free tier available
- **Railway** - Simple deployment, good for full-stack apps
- **Render** - Reliable, good documentation
- **Self-hosted** - Full control, requires server management

### Step 2: Prepare for Deployment

1. Update `BASE_URL` in environment variables to your production domain
2. Update Google OAuth redirect URI in Google Cloud Console
3. Set `NODE_ENV=production`
4. Generate a new `SESSION_SECRET` for production
5. Ensure `OPENAI_API_KEY` has sufficient credits

### Step 3: Deploy

**For Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**For Railway:**
```bash
npm install -g @railway/cli
railway login
railway up
```

**For Render:**
- Connect GitHub repository
- Set build command: `npm run build`
- Set start command: `node dist/index.js`

**For Self-Hosted:**
```bash
npm run build
# Upload dist/ folder to your server
node dist/index.js
```

### Step 4: Post-Deployment

1. Update Google OAuth redirect URI:
   - Go to Google Cloud Console
   - Update "Authorized redirect URIs" to: `https://your-deployed-domain.com/api/auth/google/callback`

2. Test the deployed app:
   ```bash
   curl https://yourdomain.com/api/user
   ```

3. Verify all features:
   - Local login/signup
   - Google OAuth login
   - Image upload and processing
   - Edit generation
   - History retrieval

## Google OAuth Troubleshooting

### Issue: "redirect_uri_mismatch"
**Solution:**
- Ensure `BASE_URL` environment variable matches your deployment domain
- Verify redirect URI in Google Cloud Console matches exactly: `https://yourdomain.com/api/auth/google/callback`
- No trailing slashes or extra characters

### Issue: "invalid_client"
**Solution:**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check they're not swapped
- Ensure they're for a "Web application" credential type

### Issue: "access_denied"
**Solution:**
- User may have declined permissions
- Check browser console for error details
- Ensure email scope is requested in OAuth consent screen

### Issue: "localhost:5000 is not allowed"
**Solution:**
- Add `http://localhost:5000` to "Authorized JavaScript origins" in Google Cloud Console
- Add `http://localhost:5000/api/auth/google/callback` to "Authorized redirect URIs"

## Security Checklist

- [ ] `SESSION_SECRET` is set to a cryptographically random value
- [ ] `OPENAI_API_KEY` is not exposed in frontend code
- [ ] `GOOGLE_CLIENT_SECRET` is not exposed in frontend code
- [ ] Database credentials are not in version control
- [ ] `.env` file is in `.gitignore`
- [ ] HTTPS is enabled on production domain
- [ ] Password requirements enforced (8+ chars, 1 uppercase, 1 number)
- [ ] Rate limiting considered for API endpoints
- [ ] Error messages don't leak sensitive information

## Performance Optimization

- [ ] Build is optimized: `npm run build`
- [ ] Database connection pooling enabled (Neon default)
- [ ] Static assets cached with appropriate headers
- [ ] API responses are compressed (gzip)
- [ ] CDN configured for static assets (optional)
- [ ] OpenAI API responses cached when possible

## Monitoring & Maintenance

### Set Up Monitoring
- Error tracking: Sentry, Rollbar, or similar
- Uptime monitoring: Pingdom, UptimeRobot
- Performance monitoring: New Relic, DataDog
- API usage: OpenAI Dashboard

### Regular Maintenance
- Monitor OpenAI API costs
- Check database performance
- Review error logs weekly
- Update dependencies monthly
- Backup database regularly

## Support & Resources

- **OpenAI Docs**: https://platform.openai.com/docs
- **Google OAuth Docs**: https://developers.google.com/identity/protocols/oauth2
- **Neon Docs**: https://neon.tech/docs
- **Express.js Docs**: https://expressjs.com
- **React Docs**: https://react.dev

## Notes

- Google OAuth is **optional** but recommended for better UX
- Local authentication (username/password) works independently
- All features work without Google OAuth enabled
- Google OAuth can be added/removed without affecting existing users
