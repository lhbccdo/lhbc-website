// Firebase Config - Your unique config
const firebaseConfig = {
  apiKey: "AIzaSyCa7xd7wyEEeoQ4y1HYBSrHr1VNzL1hX8Y",
  authDomain: "lhbc-media-hub.firebaseapp.com",
  projectId: "lhbc-media-hub",
  storageBucket: "lhbc-media-hub.firebasestorage.app",
  messagingSenderId: "451866693777",
  appId: "1:451866693777:web:bc1c85ceae7d95ef9b2f30",
  measurementId: "G-3SY609VXPJ"
};

// Initialize Firebase (using compat for global access)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Helper: Extract YouTube ID from URL
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const p = u.pathname.split('/');
    return p.pop() || p[p.length - 2];  // Handle /embed/ or /watch?v=
  } catch (e) {
    return null;
  }
}

// Show message (success/error)
function showMsg(text, isError = false) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${isError ? 'error' : ''}`;
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 4000);
}

// Escape HTML to prevent XSS
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// Handle actions: play or delete
function handleAction(action, id) {
  if (action === 'play') {
    getSubmission(id).then(item => {
      if (item && item.youtube) {
        window.open(item.youtube, '_blank');
      } else {
        showMsg('Could not load video.', true);
      }
    });
  } else if (action === 'delete') {
    if (!confirm('Delete this submission? This cannot be undone.')) return;
    db.collection('submissions').doc(id).delete()
      .then(() => {
        renderPlaylist();
        showMsg('Deleted successfully.');
      })
      .catch(e => {
        showMsg('Error deleting: ' + e.message, true);
      });
  }
}

// Get single submission by doc ID (for play button)
function getSubmission(id) {
  return db.collection('submissions').doc(id).get()
    .then(docSnap => {
      if (docSnap.exists) {
        return { id, ...docSnap.data() };
      }
      return null;
    })
    .catch(e => {
      console.error('Error fetching submission:', e);
      return null;
    });
}

// Render playlist from Firebase
function renderPlaylist() {
  const container = document.getElementById('playlist');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading submissions...</div>';  // Show loading

  db.collection('submissions').orderBy('created', 'desc').get()
    .then(snapshot => {
      container.innerHTML = '';  // Clear loading

      if (snapshot.empty) {
        container.innerHTML = '<div class="empty">No submissions yet. Ask members to submit songs/videos!</div>';
        return;
      }

      snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        const div = document.createElement('div');
        div.className = 'playlist-item';
        const thumbUrl = item.image || (item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg` : '');
        div.innerHTML = `
          <div class="thumb">
            ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Thumbnail" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';"/>` : '<div style="background:#ddd;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>'}
          </div>
          <div class="info">
            <h4>${escapeHtml(item.title || '(No title)')}</h4>
            <p>${escapeHtml(item.performer || 'Unknown')} · ${new Date(item.created).toLocaleString()}</p>
            ${item.notes ? `<p style="color:var(--muted);font-size:13px;margin-top:8px;">${escapeHtml(item.notes)}</p>` : ''}
          </div>
          <div class="controls">
            <button class="small-btn" data-action="play" data-id="${item.id}">▶ Play</button>
            <button class="small-btn" data-action="delete" data-id="${item.id}">🗑 Delete</button>
          </div>
        `;
        container.appendChild(div);
      });

      // Add event listeners to buttons
      container.querySelectorAll('.controls button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          handleAction(action, id);
        });
      });
    })
    .catch(e => {
      console.error('Error loading playlist:', e);
      container.innerHTML = '<div class="empty error">Error loading submissions. Check your connection or try refreshing.</div>';
    });
}

// Main event listener (runs when page loads)
document.addEventListener('DOMContentLoaded', () => {
  // Handle form submission on submit.html
  const form = document.getElementById('submitForm');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="loading"></span>Saving...';
      submitBtn.disabled = true;

      const title = document.getElementById('title').value.trim();
      const performer = document.getElementById('performer').value.trim();
      const youtube = document.getElementById('youtube').value.trim();
      const image = document.getElementById('image').value.trim();
      const notes = document.getElementById('notes').value.trim();

      // Validation
      if (!title) {
        showMsg('Song title is required.', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }
      if (!youtube) {
        showMsg('YouTube link is required.', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      const youtubeId = extractYouTubeId(youtube);
      if (!youtubeId) {
        showMsg('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID).', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Save to Firebase
      db.collection('submissions').add({
        title,
        performer: performer || null,
        youtube,
        youtubeId,
        image: image || null,
        notes: notes || null,
        created: firebase.firestore.FieldValue.serverTimestamp()  // Use server time for accurate sorting
      })
      .then(() => {
        form.reset();
        showMsg('Submission saved successfully! It will appear in the playlist for everyone to see.');
        // Optionally, redirect to playlist after success
        // window.location.href = 'playlist.html';
      })
      .catch(e => {
        console.error('Error saving submission:', e);
        showMsg('Error saving submission. Please try again or check your connection.', true);
      })
      .finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // Auto-load playlist on playlist.html
  const playlistEl = document.getElementById('playlist');
  if (playlistEl) {
    renderPlaylist();
  }
});
