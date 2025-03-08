import { useState, useEffect } from 'react';

declare global {
  interface Window {
    gapi: typeof gapi & {
      auth2: {
        getAuthInstance: () => gapi.auth2.GoogleAuth;
        init(params: gapi.auth2.ClientConfig): Promise<gapi.auth2.GoogleAuth>;
      };
    };
    google: any;
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

interface GoogleAuthConfig {
  apiKey?: string;
  discoveryDocs?: string[];
  clientId?: string;
  scope?: string;
  plugin_name?: string;
  hosted_domain?: string;
  cookiepolicy?: string; // Add this to fix the error
}

export function useGoogleAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGapiAndInit = async () => {
      try {
        if (!import.meta.env.VITE_GOOGLE_CLIENT_ID || !import.meta.env.VITE_GOOGLE_API_KEY) {
          setError('Missing Google OAuth credentials');
          return;
        }

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = () => resolve();
          script.onerror = (error) => reject(error);
          document.body.appendChild(script);
        });

        await new Promise<void>((resolve) => {
          window.gapi.load('client:auth2', resolve);
        });

        try {
          await window.gapi.client.init({
            apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
            clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            discoveryDocs: [
              'https://sheets.googleapis.com/$discovery/rest?version=v4',
            ],
            scope: SCOPES.join(' '),
            cookiepolicy: 'single_host_origin',
            plugin_name: 'your_app_name'
          } as GoogleAuthConfig);

          const authInstance = window.gapi.auth2.getAuthInstance();
          setIsSignedIn(authInstance.isSignedIn.get());
          setIsInitialized(true);

          authInstance.isSignedIn.listen((signedIn: boolean) => {
            setIsSignedIn(signedIn);
          });
        } catch (error: any) {
          console.error('Error initializing client:', error);
          if (error?.error === 'idpiframe_initialization_failed') {
            setError('Invalid origin. Please check OAuth configuration.');
          } else {
            setError('Failed to initialize Google API client');
          }
        }
      } catch (error) {
        console.error('Error loading Google API:', error);
        setError('Failed to load Google API');
      }
    };

    loadGapiAndInit();

    return () => {
      // Cleanup scripts on unmount
      ['https://apis.google.com/js/api.js', 'https://accounts.google.com/gsi/client'].forEach(src => {
        const script = document.querySelector(`script[src="${src}"]`);
        if (script) {
          document.body.removeChild(script);
        }
      });
    };
  }, []);

  const signIn = async () => {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      if (!authInstance) {
        throw new Error('Google API not initialized');
      }
      await authInstance.signIn({
        prompt: 'select_account',
        ux_mode: 'popup'
      });
    } catch (error: any) {
      // Handle user closing the popup gracefully
      if (error?.error === 'popup_closed_by_user') {
        console.log('Sign-in cancelled by user');
        return;
      }
      console.error('Sign in error:', error);
      setError('Failed to sign in');
    }
  };

  const signOut = async () => {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      if (!authInstance) {
        throw new Error('Google API not initialized');
      }
      await authInstance.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
    }
  };

  return {
    isSignedIn,
    isInitialized,
    error,
    signIn,
    signOut
  };
}