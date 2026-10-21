import test from 'node:test';
import assert from 'node:assert/strict';
import { androidInput } from '../src/services/input';

test('Coordinate Mapping: Exact Aspect Ratio Match (16:9)', () => {
  // Container 1600 x 900 (exact 16:9)
  const result = androidInput.mapTouchToNormalized({
    touchX: 800,
    touchY: 450,
    containerWidth: 1600,
    containerHeight: 900,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(result.isInsideDisplay, true);
  assert.equal(result.x, 0.5);
  assert.equal(result.y, 0.5);
});

test('Coordinate Mapping: Pillarboxed Phone Viewport (Tall Portrait 9:16 or 9:19.5)', () => {
  // Typical phone screen: 400 width x 800 height (aspect 0.5, much narrower than 1.777)
  // Rendered video height = 400 / (16/9) = 225
  // Top/bottom letterbox = (800 - 225) / 2 = 287.5
  const resultCenter = androidInput.mapTouchToNormalized({
    touchX: 200,
    touchY: 400, // exact center
    containerWidth: 400,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultCenter.isInsideDisplay, true);
  assert.equal(resultCenter.x, 0.5);
  assert.equal(resultCenter.y, 0.5);

  // Touch in the top black letterbox bar
  const resultTopBlackBar = androidInput.mapTouchToNormalized({
    touchX: 200,
    touchY: 50, // inside top padding
    containerWidth: 400,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultTopBlackBar.isInsideDisplay, false);
});

test('Coordinate Mapping: Letterboxed Viewport (Ultrawide container)', () => {
  // Container 2000 x 800 (aspect 2.5, wider than 16:9)
  // Rendered video width = 800 * (16/9) = 1422.22
  // Left/right pillarbox = (2000 - 1422.22) / 2 = 288.88
  const resultCenter = androidInput.mapTouchToNormalized({
    touchX: 1000,
    touchY: 400,
    containerWidth: 2000,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultCenter.isInsideDisplay, true);
  assert.equal(resultCenter.x, 0.5);
  assert.equal(resultCenter.y, 0.5);

  // Touch in the left black bar
  const resultLeftBar = androidInput.mapTouchToNormalized({
    touchX: 50,
    touchY: 400,
    containerWidth: 2000,
    containerHeight: 800,
    desktopAspectRatio: 16 / 9,
  });

  assert.equal(resultLeftBar.isInsideDisplay, false);
});

test('Coordinate Mapping: Clamps bounds to [0.0, 1.0]', () => {
  const resultOutOfBounds = androidInput.mapTouchToNormalized({
    touchX: 9999,
    touchY: 9999,
    containerWidth: 1000,
    containerHeight: 1000,
    desktopAspectRatio: 1.0,
  });

  assert.equal(resultOutOfBounds.isInsideDisplay, false);
  assert.equal(resultOutOfBounds.x, 1.0);
  assert.equal(resultOutOfBounds.y, 1.0);
});
