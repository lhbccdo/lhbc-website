// firebase.js
// Centralized Firebase configuration and initialization

const firebaseConfig = {
  apiKey: "YOUR_NEW_API_KEY_HERE",
  authDomain: "lhbc-media-hub.firebaseapp.com",
  projectId: "lhbc-media-hub",
  storageBucket: "lhbc-media-hub.firebasestorage.app",
  messagingSenderId: "451866693777",
  appId: "1:451866693777:web:dcdc3f8fa6f4b5c79b2f30",
  measurementId: "G-3SY609VXPJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get service references
export const db = firebase.firestore();
export const auth = firebase.auth();

// Admin email list
export const ADMIN_EMAILS = ['lhbc.cdo@gmail.com', 'hans55jerald@gmail.com'];

// Helper to check if current user is an admin
export function isAdminUser() {
  const user = auth.currentUser;
  return user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// Helper to extract YouTube ID
export function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const p = u.pathname.split('/');
    // Handles paths like /watch?v=VIDEO_ID or /embed/VIDEO_ID or /v/VIDEO_ID
    const potentialId = p.pop() || p[p.length - 2];
    // Basic validation for common YouTube ID length
    if (potentialId && potentialId.length === 11) {
        return potentialId;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Global utility for showing toasts (moved from script.js)
let toastCounter = 0;
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found!');
        return;
    }

    const toast = document.createElement('div');
    toast.id = `toast-${toastCounter++}`;
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    container.appendChild(toast);

    // Force reflow for CSS transition
    void toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}