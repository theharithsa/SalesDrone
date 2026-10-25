# Working with lead details

On desktop (viewport wider than 1,000 CSS pixels), open a lead and drag the blade’s left edge toward the left to widen it, or right to narrow it. Width is bounded to retain space for the lead list, with a normal minimum of 360px and a maximum of 1,100px; smaller embedded containers clamp further. The expand icon selects the available maximum. Restore or double-click the edge returns to the default 420px width (clamped to available space).

Keyboard: Tab to Resize lead details. Arrow Left widens by 24px; Arrow Right narrows by 24px. Shift doubles the step. Home selects minimum width and End selects maximum. Width is saved as a number in this browser’s local storage, with a safe fallback when storage is unavailable. It is not a Firestore setting, contains no lead/user data and is not synchronized between devices.

The workflow header contains stage and assignment above the profile, journey, score and enquiry information. On desktop it remains outside the independently scrolling blade body. Stage editing still needs leads:edit; the Admin assignment selector retains existing server permissions and expected-version checks. Other users see assignment status without gaining access to the member directory. About reassignment explains that changing ownership cancels pending lead tasks.

At a blade container width of 500px or more, the configured journey runs horizontally. Long/custom stage paths scroll inside the journey, not the whole viewport. Narrower blades keep the vertical path. Only the current stage is highlighted: a configured path does not prove that earlier stages occurred, and recorded history remains separate. No new API requests, AI generations or domain events are triggered by dragging or changing orientation.

On phones/tablets up to 1,000px, the existing full-page details view remains and the resize control is hidden. Workflow controls are placed first and the mobile header stays sticky. Opening uses a 120ms opacity fade; desktop uses a clipped 180ms opacity/18px horizontal entrance. Reduced-motion preferences disable movement. Pointer resizing directly updates width on animation frames, without width transitions or momentum. Closing clears the blade immediately rather than retaining permission-scoped lead data for an exit animation.

The existing PATCH lead and PATCH assignment operations are unchanged; GET journey retains current authorization, pagination and recorded-history rules. See [API](API.md) and [settings](SETTINGS.md).
