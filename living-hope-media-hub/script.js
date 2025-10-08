// Simple client-side storage for demo
const STORAGE_KEY = 'lhbc_submissions_v1';

// Helper: Get list from localStorage
function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading localStorage:', e);
    return [];
  }
}

// Helper: Save list to localStorage
function saveList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    alert('Storage error: Could not save submission. Please try again.');
  }
}

// YouTube ID extractor (supports standard YouTube URLs and youtu.be)
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1);
    }
    if (u.searchParams.get('v')) {
      return u.searchParams.get('v');
    }
    // Fallback: last segment of pathname
    const p = u.pathname.split('/');
    return p.pop();
  } catch (e) {
    return null;
  }
}

// Show message (success or error)
function showMsg(text, isError = false) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${isError ? 'error' : ''}`;
  setTimeout(() => {
    el.textContent = '';
    el.className = 'msg';
  }, 4000);
}

// Escape HTML to prevent XSS
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

// Swap array elements for reordering
function swap(arr, a, b) {
  [arr[a], arr[b]] = [arr[b], arr[a]];
}

// Handle playlist actions (up, down, play, delete)
function handleAction(action, idx) {
  const list = readList();
  if (action === 'play') {
    const item = list[idx];
    if (item && item.youtube) {
      window.open(item.youtube, '_blank');
    }
  } else if (action === 'delete') {
    if (!confirm('Delete this submission? This cannot be undone.')) return;
    list.splice(idx, 1);
    saveList(list);
    renderPlaylist();
  } else if (action === 'up') {
    if (idx <= 0) return;
    swap(list, idx, idx - 1);
    saveList(list);
    renderPlaylist();
  } else if (action === 'down') {
    if (idx >= list.length - 1) return;
    swap(list, idx, idx + 1);
    saveList(list);
    renderPlaylist();
  }
}

// Render playlist items
function renderPlaylist() {
  const container = document.getElementById('playlist');
  if (!container) return;

  const data = readList();
  container.innerHTML = ''; // Clear everything, including initial empty div

  if (!data.length) {
    container.innerHTML = '<div class="empty">No submissions yet. Ask members to submit songs.</div>';
    return;
  }

  data.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'playlist-item';
    const thumbUrl = item.image || `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`;
    div.innerHTML = `
      <div class="thumb">
        <img src="${escapeHtml(thumbUrl)}" alt="Thumbnail for ${escapeHtml(item.title || 'Untitled')}" style="width:100%;height:100%;object-fit:cover;" />
      </div>
      <div class="info">
        <h4>${escapeHtml(item.title || '(No title)')}</h4>
        <p>${escapeHtml(item.performer || 'Unknown performer')} · ${new Date(item.created).toLocaleString()}</p>
        ${item.notes ? `<p style="color:var(--muted);font-size:13px;margin-top:8px;">${escapeHtml(item.notes)}</p>` : ''}
      </div>
      <div class="controls">
        <button class="small-btn" data-action="up" data-idx="${idx}">↑</button>
        <button class="small-btn" data-action="down" data-idx="${idx}">↓</button>
        <button class="small-btn" data-action="play" data-idx="${idx}">▶ Play</button>
        <button class="small-btn" data-action="delete" data-idx="${idx}">🗑 Delete</button>
      </div>
    `;
    container.appendChild(div);
  });

  // Add event listeners to new buttons
  container.querySelectorAll('.controls button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.getAttribute('data-action');
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      handleAction(action, idx);
    });
  });
}

// Main event listener
document.addEventListener('DOMContentLoaded', () => {
  // Handle form submission on submit.html
  const form = document.getElementById('submitForm');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      
      // Show loading on submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = `<span class="loading"></span>Saving...`;
      submitBtn.disabled = true;

      const title = document.getElementById('title').value.trim();
      const performer = document.getElementById('performer').value.trim();
      const youtube = document.getElementById('youtube').value.trim();
      const image = document.getElementById('image').value.trim();
      const notes = document.getElementById('notes').value.trim();

      if (!title || !youtube) {
        showMsg('Please fill in the required fields (Song Title and YouTube Link).', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      const id = extractYouTubeId(youtube);
      if (!id) {
        showMsg('Invalid YouTube URL. Please provide a valid full URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID).', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      const list = readList();
      list.push({
        id: Date.now(),
        title,
        performer,
        youtube,
        youtubeId: id,
        image,
        notes,
        created: new Date().toISOString()
      });

      saveList(list);
      form.reset();
      showMsg('Submission saved successfully! It will appear in the playlist.');
      
      // Reset button
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    });
  }

  // Render playlist on playlist.html
  const playlistEl = document.getElementById('playlist');
  if (playlistEl) {
    renderPlaylist();
  }
});