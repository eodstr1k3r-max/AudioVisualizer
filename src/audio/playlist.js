let playlist = [];
let currentIndex = 0;
let isLooping = false;
let isShuffled = false;

export function addTracks(files) {
  const newTracks = Array.from(files).filter(f => f.type.startsWith('audio/')).map(file => ({
    name: file.name,
    url: URL.createObjectURL(file),
    file
  }));
  playlist.push(...newTracks);
  updatePlaylistUi();
  if (playlist.length === newTracks.length && playlist.length > 0) {
    currentIndex = 0;
  }
}

export function getCurrentTrack() {
  if (!playlist.length) return null;
  return playlist[currentIndex];
}

export function nextTrack() {
  if (!playlist.length) return null;
  if (isShuffled) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else {
    currentIndex = (currentIndex + 1) % playlist.length;
  }
  updatePlaylistUi();
  return getCurrentTrack();
}

export function prevTrack() {
  if (!playlist.length) return null;
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  updatePlaylistUi();
  return getCurrentTrack();
}

function updatePlaylistUi() {
  const container = document.getElementById('playlistContainer');
  if (!container) return;
  container.innerHTML = '';
  
  playlist.forEach((track, idx) => {
    const item = document.createElement('div');
    item.style.padding = '6px 10px';
    item.style.borderRadius = '8px';
    item.style.cursor = 'pointer';
    item.style.fontSize = '0.82rem';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.background = idx === currentIndex ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.03)';
    item.style.border = idx === currentIndex ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent';
    
    item.innerHTML = `<span>${idx + 1}. ${track.name}</span>`;
    item.addEventListener('click', () => {
      currentIndex = idx;
      updatePlaylistUi();
      const audioEl = document.getElementById('audio');
      const track = getCurrentTrack();
      if (audioEl && track) {
        audioEl.src = track.url;
        audioEl.load();
        audioEl.play().catch(() => {});
        document.getElementById('fileName').textContent = track.name;
      }
    });
    container.appendChild(item);
  });
}
