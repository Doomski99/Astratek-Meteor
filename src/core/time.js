function normalizeTime(value, duration, loopEnabled) {
  if (!loopEnabled) {
    if (duration > 0) {
      return Math.min(Math.max(value, 0), duration);
    }
    return Math.max(value, 0);
  }

  if (duration <= 0) {
    return value;
  }

  const wrapped = value % duration;
  return wrapped < 0 ? wrapped + duration : wrapped;
}

function createSimulationClock({ duration = 60 * 60 * 1000, loop = true } = {}) {
  let time = 0;
  let paused = false;
  let loopEnabled = loop;
  let totalDuration = duration;

  const listeners = new Set();

  function emit() {
    const snapshot = { time, paused, duration: totalDuration };
    listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('Simulation clock listener failed:', error);
      }
    });
  }

  function setTime(newTime) {
    const nextTime = normalizeTime(newTime, totalDuration, loopEnabled);
    if (nextTime === time) {
      return time;
    }
    time = nextTime;
    emit();
    return time;
  }

  function advance(delta) {
    if (paused || delta === 0) {
      return time;
    }

    return setTime(time + delta);
  }

  function reset() {
    setTime(0);
  }

  function setPaused(nextPaused) {
    const target = Boolean(nextPaused);
    if (target === paused) {
      return paused;
    }
    paused = target;
    emit();
    return paused;
  }

  function togglePaused() {
    return setPaused(!paused);
  }

  function setDuration(newDuration) {
    if (!Number.isFinite(newDuration) || newDuration <= 0) {
      throw new Error('Simulation duration must be a positive finite number.');
    }
    totalDuration = newDuration;
    time = normalizeTime(time, totalDuration, loopEnabled);
    emit();
    return totalDuration;
  }

  function setLoop(enabled) {
    loopEnabled = Boolean(enabled);
    time = normalizeTime(time, totalDuration, loopEnabled);
    emit();
    return loopEnabled;
  }

  function getState() {
    return { time, paused, duration: totalDuration, loop: loopEnabled };
  }

  function getTime() {
    return time;
  }

  function getDuration() {
    return totalDuration;
  }

  function isPaused() {
    return paused;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Simulation clock listener must be a function.');
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function createChannel(initialMultiplier = 1) {
    let multiplier = initialMultiplier;
    let offset = 0;

    function getValue() {
      return time * multiplier + offset;
    }

    function setMultiplier(nextMultiplier) {
      if (nextMultiplier === multiplier) {
        return multiplier;
      }
      const currentValue = getValue();
      multiplier = nextMultiplier;
      offset = currentValue - time * multiplier;
      return multiplier;
    }

    function setValue(nextValue) {
      offset = nextValue - time * multiplier;
      return getValue();
    }

    function resetChannel() {
      multiplier = initialMultiplier;
      offset = 0;
      return getValue();
    }

    return {
      getValue,
      getMultiplier: () => multiplier,
      setMultiplier,
      setValue,
      reset: resetChannel
    };
  }

  return {
    advance,
    reset,
    setTime,
    getTime,
    getState,
    getDuration,
    setDuration,
    setPaused,
    isPaused,
    togglePaused,
    setLoop,
    subscribe,
    createChannel
  };
}

export { createSimulationClock };
