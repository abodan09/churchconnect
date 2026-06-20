// @base44/sdk has been removed. All callers should import from @/api/client instead.
// This stub prevents build errors if any import is missed.
export const base44 = {
  auth: {
    me: () => Promise.reject(new Error('base44 removed — use ClerkAuthContext')),
    logout: () => {},
    redirectToLogin: () => window.location.replace('/login'),
    updateMe: () => Promise.reject(new Error('base44 removed')),
    resetPasswordRequest: () => Promise.reject(new Error('base44 removed')),
    resetPassword: () => Promise.reject(new Error('base44 removed')),
  },
  entities: new Proxy({}, {
    get: () => new Proxy({}, {
      get: () => () => Promise.reject(new Error('base44 removed — use entities from @/api/client')),
    }),
  }),
  integrations: {
    Core: {
      UploadFile: () => Promise.reject(new Error('base44 removed — use uploadFile from @/api/client')),
      SendEmail: () => Promise.reject(new Error('base44 removed — use sendEmail from @/api/client')),
    },
  },
};
