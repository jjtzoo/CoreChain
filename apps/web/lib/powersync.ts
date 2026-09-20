// How the phone proves to PowerSync who it is (E8-2). These two values must
// match the PowerSync dashboard, instance > Client Auth:
//   JWKS URI:  <site>/api/auth/jwks
//   Audience:  the value below
//
// PowerSync rejects tokens that live longer than 24 hours and recommends about
// an hour; the app fetches a fresh one whenever it connects.
export const POWERSYNC_AUDIENCE = "corechain-powersync";
export const POWERSYNC_TOKEN_LIFETIME = "1h";
