/**
 * Keyboard and on-screen button input. Mutates state.keys and related flags.
 */
import { state } from "./state.js";

export function bindInput() {
  const keys = state.keys;

  window.addEventListener("keydown", e => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") keys.jump = true;
    if (e.code === "KeyF") keys.boost = true;
    if (e.code === "KeyG") keys.breath = true;
  });

  window.addEventListener("keyup", e => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      keys.jump = false;
      state.jumpKeyReleased = true;
    }
    if (e.code === "KeyF") keys.boost = false;
    if (e.code === "KeyG") {
      keys.breath = false;
      state.breathKeyConsumed = false;
    }
  });

  function bindButton(id, keyName) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const setKey = v => { keys[keyName] = v; };
    btn.addEventListener("pointerdown", e => { e.preventDefault(); setKey(true); });
    btn.addEventListener("pointerup", e => { e.preventDefault(); setKey(false); });
    btn.addEventListener("pointerleave", e => setKey(false));
    btn.addEventListener("pointercancel", e => setKey(false));
  }
  bindButton("btnLeft", "left");
  bindButton("btnRight", "right");
  bindButton("btnJump", "jump");
  bindButton("btnBoost", "boost");
  bindButton("btnBreath", "breath");

  document.getElementById("btnJump")?.addEventListener("pointerup", () => { state.jumpKeyReleased = true; });
  document.getElementById("btnJump")?.addEventListener("pointerleave", () => { state.jumpKeyReleased = true; });
  document.getElementById("btnBreath")?.addEventListener("pointerup", () => { state.breathKeyConsumed = false; });
  document.getElementById("btnBreath")?.addEventListener("pointerleave", () => { state.breathKeyConsumed = false; });
}
