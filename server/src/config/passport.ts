import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import config from './index.js';
import prisma from '../lib/prisma.js';
import logger from './logger.js';

// ─── JWT Strategy ─────────────────────────────────────────────────────
// Primary authentication strategy using Bearer tokens.

const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    // Also extract from cookie for browser-based sessions
    (req) => req?.cookies?.accessToken || null,
  ]),
  secretOrKey: config.jwt.secret,
  algorithms: ['HS256'],
};

passport.use(
  'jwt',
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id: payload.id,
          tenantId: payload.tenantId,
          isActive: true,
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          name: true,
          role: true,
          department: true,
          site: true,
          employeeId: true,
        },
      });

      if (!user) {
        return done(null, false, { message: 'User not found or inactive' });
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

// ─── SAML 2.0 Strategy (Skeleton) ────────────────────────────────────
// Enable by setting SAML_* environment variables and installing passport-saml.
//
// npm install passport-saml @types/passport-saml
//
// Environment variables:
//   SAML_ENTRY_POINT    - IdP SSO URL (e.g., https://idp.example.com/sso)
//   SAML_ISSUER         - SP entity ID
//   SAML_CALLBACK_URL   - ACS callback URL (e.g., https://app.example.com/api/v1/auth/saml/callback)
//   SAML_CERT           - IdP public certificate (PEM, base64-encoded)
//   SAML_PRIVATE_KEY    - SP private key for signing requests (optional)

export function configureSaml(): void {
  const entryPoint = process.env.SAML_ENTRY_POINT;
  const issuer = process.env.SAML_ISSUER;
  const callbackUrl = process.env.SAML_CALLBACK_URL;
  const cert = process.env.SAML_CERT;

  if (!entryPoint || !issuer || !callbackUrl || !cert) {
    logger.info('SAML SSO not configured - skipping SAML strategy registration');
    return;
  }

  try {
    // Dynamic import to avoid requiring passport-saml when not in use
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Strategy: SamlStrategy } = require('passport-saml');

    passport.use(
      'saml',
      new SamlStrategy(
        {
          entryPoint,
          issuer,
          callbackUrl,
          cert,
          privateKey: process.env.SAML_PRIVATE_KEY || undefined,
          identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          wantAssertionsSigned: true,
          signatureAlgorithm: 'sha256',
        },
        async (profile: Record<string, string>, done: Function) => {
          try {
            const email = profile.nameID || profile.email;
            if (!email) {
              return done(new Error('No email in SAML assertion'), false);
            }

            // Look up the user by email across all tenants
            const user = await prisma.user.findFirst({
              where: { email, isActive: true },
              select: {
                id: true,
                tenantId: true,
                email: true,
                name: true,
                role: true,
                department: true,
                site: true,
                employeeId: true,
              },
            });

            if (!user) {
              return done(null, false, { message: 'SAML user not provisioned in Quantum Kaizen' });
            }

            return done(null, user);
          } catch (error) {
            return done(error, false);
          }
        }
      )
    );

    logger.info('SAML 2.0 strategy registered successfully');
  } catch {
    logger.warn('passport-saml not installed - SAML SSO unavailable. Run: npm install passport-saml');
  }
}

// ─── OpenID Connect Strategy (Skeleton) ──────────────────────────────
// Enable by setting OIDC_* environment variables and installing openid-client / passport-openidconnect.
//
// npm install passport-openidconnect
//
// Environment variables:
//   OIDC_ISSUER          - OIDC provider issuer URL (e.g., https://accounts.google.com)
//   OIDC_CLIENT_ID       - Client ID
//   OIDC_CLIENT_SECRET   - Client Secret
//   OIDC_CALLBACK_URL    - Redirect URI (e.g., https://app.example.com/api/v1/auth/oidc/callback)
//   OIDC_SCOPE           - Scopes (default: "openid profile email")

export function configureOidc(): void {
  const issuerUrl = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const callbackUrl = process.env.OIDC_CALLBACK_URL;

  if (!issuerUrl || !clientId || !clientSecret || !callbackUrl) {
    logger.info('OIDC SSO not configured - skipping OIDC strategy registration');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenIDConnectStrategy = require('passport-openidconnect');

    passport.use(
      'oidc',
      new OpenIDConnectStrategy(
        {
          issuer: issuerUrl,
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL: callbackUrl,
          scope: (process.env.OIDC_SCOPE || 'openid profile email').split(' '),
        },
        async (
          _issuer: string,
          profile: Record<string, unknown>,
          done: Function
        ) => {
          try {
            const emails = profile.emails as Array<{ value: string }> | undefined;
            const email = emails?.[0]?.value || (profile.email as string);

            if (!email) {
              return done(new Error('No email in OIDC profile'), false);
            }

            const user = await prisma.user.findFirst({
              where: { email, isActive: true },
              select: {
                id: true,
                tenantId: true,
                email: true,
                name: true,
                role: true,
                department: true,
                site: true,
                employeeId: true,
              },
            });

            if (!user) {
              return done(null, false, { message: 'OIDC user not provisioned in Quantum Kaizen' });
            }

            return done(null, user);
          } catch (error) {
            return done(error, false);
          }
        }
      )
    );

    logger.info('OIDC strategy registered successfully');
  } catch {
    logger.warn('passport-openidconnect not installed - OIDC SSO unavailable. Run: npm install passport-openidconnect');
  }
}

// ─── Serialization ────────────────────────────────────────────────────
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as Record<string, string>).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        department: true,
        site: true,
        employeeId: true,
      },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ─── Initialize all configured strategies ─────────────────────────────
export function initializePassport(): void {
  configureSaml();
  configureOidc();
  logger.info('Passport authentication initialized');
}

export default passport;
