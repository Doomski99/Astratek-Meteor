const STYLE_ID = 'time-controls-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .time-controls {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.55);
      color: #f8f9fa;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 10;
      backdrop-filter: blur(8px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }

    .time-controls__button {
      appearance: none;
      border: none;
      background: #00b4d8;
      color: #fff;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .time-controls__button:focus-visible {
      outline: 2px solid #90e0ef;
      outline-offset: 2px;
    }

    .time-controls__button:hover {
      background: #0096c7;
    }

    .time-controls__slider {
      width: min(45vw, 320px);
    }

    .time-controls__label {
      font-size: 0.85rem;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .time-controls__speed-group {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 4px;
    }

    .time-controls__speed-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(248, 249, 250, 0.75);
    }

    .time-controls__speed-button {
      appearance: none;
      border: none;
      background: rgba(255, 255, 255, 0.12);
      color: #f1f5f9;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }

    .time-controls__speed-button:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .time-controls__speed-button:focus-visible {
      outline: 2px solid #90e0ef;
      outline-offset: 2px;
    }

    .time-controls__speed-button--active {
      background: #48cae4;
      color: #001219;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
    }
  `;

  document.head.appendChild(style);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(String(hours).padStart(2, '0'));
  }
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(seconds).padStart(2, '0'));

  return parts.join(':');
}

const SPEED_OPTIONS = [1, 2, 5, 10, 100];

function initTimeControls(clock, { container = document.body } = {}) {
  if (!clock) {
    throw new Error('Simulation clock instance is required for time controls.');
  }

  ensureStyles();

  const wrapper = document.createElement('div');
  wrapper.className = 'time-controls';

  const playPauseButton = document.createElement('button');
  playPauseButton.className = 'time-controls__button';
  playPauseButton.type = 'button';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'time-controls__slider';
  slider.min = '0';
  slider.step = '100';

  const label = document.createElement('span');
  label.className = 'time-controls__label';

  const speedGroup = document.createElement('div');
  speedGroup.className = 'time-controls__speed-group';

  const speedLabel = document.createElement('span');
  speedLabel.className = 'time-controls__speed-label';
  speedLabel.textContent = 'Speed';
  speedGroup.appendChild(speedLabel);

  const speedButtons = SPEED_OPTIONS.map(rate => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'time-controls__speed-button';
    button.textContent = `${rate}x`;
    button.addEventListener('click', () => {
      clock.setPlaybackRate(rate);
    });
    speedGroup.appendChild(button);
    return { rate, button };
  });

  wrapper.appendChild(playPauseButton);
  wrapper.appendChild(slider);
  wrapper.appendChild(speedGroup);
  wrapper.appendChild(label);

  const updateUI = state => {
    const { time, paused, duration, playbackRate = 1 } = state;
    slider.max = String(duration);
    slider.value = String(time);
    playPauseButton.textContent = paused ? 'Play' : 'Pause';

    const formattedCurrent = formatTime(time);
    const formattedDuration = formatTime(duration);
    label.textContent = `${formattedCurrent} / ${formattedDuration}`;

    speedButtons.forEach(({ rate, button }) => {
      const isActive = Math.abs(rate - playbackRate) < 1e-9;
      button.classList.toggle('time-controls__speed-button--active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const unsubscribe = clock.subscribe(updateUI);
  updateUI(clock.getState());

  playPauseButton.addEventListener('click', () => {
    clock.togglePaused();
  });

  slider.addEventListener('input', event => {
    const nextValue = Number(event.target.value);
    clock.setTime(nextValue);
  });

  if (container) {
    container.appendChild(wrapper);
  }

  return {
    element: wrapper,
    destroy() {
      unsubscribe();
      wrapper.remove();
    }
  };
}

export { initTimeControls };
