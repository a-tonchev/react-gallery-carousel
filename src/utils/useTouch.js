import { useEffect, useRef } from 'react';

const getTouchDistinguisher = () => {
  const pinchTouchIdentifiers = new Set(); // record all pinch touch identifiers

  function _recordPinchTouchIdentifiers(event) {
    for (const touch of event.touches) {
      pinchTouchIdentifiers.add(touch.identifier);
    }
  }

  function _isPinch(event) {
    return event.touches !== undefined && event.touches.length > 1;
  }

  function _wasPinch(event) {
    // check for the one finger that was part of a multi-finger pinch zoom
    return (
      event.changedTouches &&
      pinchTouchIdentifiers.has(event.changedTouches[0].identifier)
    );
  }

  function isPinch(event) {
    if (_isPinch(event)) {
      _recordPinchTouchIdentifiers(event);
      return true;
    }
    return _wasPinch(event);
  }

  return { isPinch };
};

const useTouch = (elementRef, { onTouchMove, onTouchEnd, onTap }) => {
  /*
    Everything below used to live in `let` bindings in the hook body, and the listeners were
    re-registered on every render (the `events` array was a new object each time, so the
    effect's dependency changed). A single re-render in the middle of a swipe therefore reset
    `isTouchStarted` to false, and every following touchmove bailed out at the guard - the
    slide stopped following the finger half way through the gesture. Keeping the gesture
    state in a ref, and registering the listeners once per element, makes the gesture
    independent of the render cycle.
  */
  const gestureRef = useRef(null);
  if (gestureRef.current === null) {
    gestureRef.current = {
      touchDistinguisher: getTouchDistinguisher(),
      touchStartX: 0,
      touchStartY: 0,
      isTouchStarted: false,
      isTouchMoved: false,
      previousX: 0,
      previousTime: Date.now(),
      instantaneousVelocity: 0
    };
  }

  // the listeners are registered once, so they read the current callbacks through a ref
  // rather than closing over the ones from the render that registered them
  const callbacksRef = useRef({ onTouchMove, onTouchEnd, onTap });
  callbacksRef.current = { onTouchMove, onTouchEnd, onTap };

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return undefined;

    const gesture = gestureRef.current;

    const handleVerticalMovement = (event, displacementX, displacementY) => {
      if (Math.abs(displacementX) > Math.abs(displacementY) && event.cancelable)
        event.preventDefault();
    };

    const shouldOmitEvent = (event, displacementX = 0) => {
      if (
        // touchDistinguisher only works for iOS from my investigation
        navigator.platform.match(/iPhone|iPad|iPod|MacIntel/) &&
        gesture.touchDistinguisher.isPinch(event)
      )
        return true;

      // window.visualViewport is not yet supported on IE
      if (!('visualViewport' in window)) return false;

      const { scale, offsetLeft, width } = window.visualViewport;
      if (scale <= 1.1) return false;
      // pan right at or beyond the left edge
      if (offsetLeft <= 0 && displacementX > 0) return false;
      // pan left at or beyond the right edge
      // noinspection RedundantIfStatementJS
      if (offsetLeft + width >= width * scale && displacementX < 0) return false;
      return true;
    };

    const handleTouchStart = (event) => {
      event.stopPropagation();
      gesture.isTouchStarted = true;
      gesture.isTouchMoved = false;
      gesture.touchStartX = event.touches[0].clientX;
      gesture.touchStartY = event.touches[0].clientY;
      gesture.previousX = gesture.touchStartX;
      gesture.previousTime = Date.now();
    };

    const handleTouchMove = (event) => {
      event.stopPropagation();
      if (!gesture.isTouchStarted) return;
      const displacementX = event.changedTouches[0].clientX - gesture.touchStartX;
      if (shouldOmitEvent(event, displacementX)) return;
      const displacementY = event.changedTouches[0].clientY - gesture.touchStartY;
      handleVerticalMovement(event, displacementX, displacementY);
      callbacksRef.current.onTouchMove(displacementX, displacementY);
      gesture.isTouchMoved = true;
      gesture.instantaneousVelocity =
        (event.changedTouches[0].clientX - gesture.previousX) /
        (Date.now() - gesture.previousTime);
      gesture.previousX = event.changedTouches[0].clientX;
      gesture.previousTime = Date.now();
    };

    const handleTouchEnd = (event) => {
      // prevent the event from being recognized additionally as a mouse event on simulated mobile devices (e.g. Toggle Device Toolbar on Chrome).
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      if (!gesture.isTouchStarted) return;
      const displacementX = event.changedTouches[0].clientX - gesture.touchStartX;
      if (shouldOmitEvent(event, displacementX)) {
        callbacksRef.current.onTouchEnd(0, 0, 0);
        gesture.isTouchStarted = false;
        gesture.isTouchMoved = false;
        return;
      }
      const displacementY = event.changedTouches[0].clientY - gesture.touchStartY;
      handleVerticalMovement(event, displacementX, displacementY);
      if (gesture.isTouchMoved)
        // can not calculate velocity here since event.clientX === previousX;
        callbacksRef.current.onTouchEnd(
          displacementX,
          displacementY,
          gesture.instantaneousVelocity
        );
      else callbacksRef.current.onTap();
      gesture.isTouchStarted = false; // reset isTouchStarted for next series of touch events
      gesture.isTouchMoved = false; // reset isTouchMoved for next series of touch events
    };

    const events = [
      { event: 'touchstart', callback: handleTouchStart },
      { event: 'touchmove', callback: handleTouchMove },
      { event: 'touchend', callback: handleTouchEnd },
      { event: 'touchcancel', callback: handleTouchEnd }
    ];

    // use active event listeners to have event.cancelable === true, for later use to in calling event.preventDefault()
    events.forEach(({ event, callback }) =>
      el.addEventListener(event, callback, { passive: false })
    );

    return () => {
      events.forEach(({ event, callback }) =>
        el.removeEventListener(event, callback)
      );
    };
  }, [elementRef]);
};

export default useTouch;
