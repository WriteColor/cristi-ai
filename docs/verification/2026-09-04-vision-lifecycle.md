# Vision lifecycle verification — 2026-09-04

## Changes

- Screen capture previously replaced its periodic timer with a one-shot capture on
  `AUDIO_END`. `CaptureLoop` now owns both paths and always resumes periodic work.
- A generation identifies each capture session. Stop/start cannot overlap native
  IPC operations or publish an old result into the new session. Region changes
  invalidate results and pending transport frames from the previous view.
- Camera and screen permission requests that complete after cancellation release
  their tracks. Camera playback setup has a timeout and cancellation path.
- The dispatcher keeps the newest image per source in a bounded queue. Camera
  updates preserve screen's queue position. Retries, priority frames and
  `AUDIO_END` all respect the same transmission rate limit.
- Native capture failures return no image rather than reusing a cached image of
  another region. The normal short cache for the same region remains.
- Hangup and renderer teardown stop screen capture and clear queued images.
- Live setup explicitly includes all video between spoken turns. The API has
  different default turn coverage for Gemini 2.5 and 3.1; see the
  [official Live API reference](https://ai.google.dev/api/live#TurnCoverage).
- Visual instructions distinguish current frames from remembered images. Scoped
  Live clients may opt out of companion instructions and tools for diagnostics.

## Evidence and scope

`node --test tests/test_vision_capture_lifecycle.mjs tests/test_vision_frame_dispatcher.mjs`
passes 11 cases. These use fake clocks, deferred capture promises and mocked
permission responses; they prove scheduling, cancellation, queue fairness and
recovery semantics, not hardware frame rate or model perception.

`node --test tests/test_call_regressions.mjs` also checks the actual serialized
Live setup, including video coverage and optional scoped instructions.

`tests/test_live_vision_lifecycle.mjs` opens an isolated packaged Electron profile
and a temporary visible fixture with two randomly selected words. Images come
from the packaged application's native capture IPC. The production capture loop,
dispatcher and Live socket run in the Node test process. Expected words are never
provided in the model's prompt. Full-screen must identify both words; a top-region
crop must identify only the top word. Two subsequent frames must arrive after
the model finishes speaking. The probe receives real PCM but does not play it or
capture microphone speech. It is not an end-to-end audible call test.

Observed on Gemini 3.1 with companion context and tool declarations enabled:

| View | Visible words | Model transcript begins | First audio | Continued frames |
| --- | --- | --- | --- | --- |
| Full screen | MARIPOSA, VENTANA | Mariposa, ventana. | 1,424 ms | 2 |
| Top region | PLANETA | Planeta. | 982 ms | 2 |

Tools requested by the model receive explicit test errors; no external action
executes. Companion mode still requested avatar tools in the first round and
added an unsolicited question. Those behaviors need further orchestration work.

Earlier probes failed grounding despite correct captured JPEGs. A scoped probe
without companion instructions/tools identified both views with Gemini 3.1
(601/717 ms first audio). Gemini 2.5 identified the full view but took 16,788 ms
to begin audio; the next region request closed with server error 1011,
`The service is currently unavailable`. Do not describe that run as passing or
as evidence of zero latency. Scope isolation, coverage configuration and feed
warmup changed during debugging, so no single change is proven to explain all
differences in model grounding.

Local JSON reports and isolated browser profiles are ignored by Git. Reproduce
with `node tests/test_live_vision_lifecycle.mjs`; set
`CRISTI_VISION_COMPANION=1` to retain companion instructions/tools and
`CRISTI_VISION_MODELS` to a comma-separated model list. A valid Gemini key and an
interactive desktop are required. The test briefly covers the primary display.

`tests/test_packaged_call.mjs` additionally injects native capture failure after
seeding a real full-screen capture. A region request must return null, preventing
the old cross-region cache substitution. Its audio transport is simulated. This
test passed with no renderer errors, all 13 models loaded, and two audio-analysis
subscriptions maintained across model switches. The 38 diagnostic suites and
ESLint also passed. The NSIS build completed; its generated executable was tested
from `win-unpacked`, without running the installer on the user's installation.

## Still unproven

This change does not establish reliable hardware-camera perception, microphone
speech plus vision under sustained GPU/CPU pressure, installed NSIS lifecycle,
or absence of duplicate audible responses. Discord session correlation, memory
session isolation, translation direction/routing, proactivity and the broader
external-application requirements also remain outside this verification scope.
