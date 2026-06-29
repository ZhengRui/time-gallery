# Club Introduction Wing Design Notes

Date: 2026-06-28

## Intent

This project started as a 3D gallery for SoarHigh Toastmasters Club: each
meeting can become a room or section containing photos, posters, awards, and
meeting notes. The first production test will be smaller and more focused:
turn the Club Introduction segment for the 2026-07-01 meeting into a guided
3D presentation.

The target is not to copy the four PPT slides into 3D. The target is to make
the Club Introduction feel like a short guided museum tour: the host speaks,
the camera moves along a prepared route, key images or data walls open in
front of the audience, then shrink back before the next point.

This Club Introduction Wing is a separate area of the full gallery. Future
meeting timelines should live in another area and reuse the same exhibit and
camera-tour system.

## Source Material

Primary SoarHigh sources:

- Website: <https://soarhigh.top>
- Meetings archive: <https://soarhigh.top/meetings>
- Meeting media endpoint discovered from the site:
  `https://api.soarhigh.top/meetings/{meetingId}/media`

Toastmasters International sources should be checked from official or stable
public pages when finalizing copy and statistics:

- <https://www.toastmasters.org/about>
- <https://www.toastmasters.org/about/our-mission>
- <https://www.toastmasters.org/about/history/our-history>

The PPT currently uses these rounded figures:

- 100+ years
- 140+ countries
- 280k+ members
- 15k+ clubs
- 90+ clubs in Shenzhen

For the first demo, these PPT numbers are acceptable because they are familiar
to the host. Before publishing more broadly, verify current official
Toastmasters figures and decide whether to use official current numbers or the
more familiar PPT numbers.

## Narrative Structure

The wing should contain two small connected rooms.

### Room 1: Toastmasters International

Purpose: explain what Toastmasters is and why it matters.

Content beats:

1. Welcome and transition from SAA to Club Introduction.
2. Toastmasters as a nonprofit organization for public speaking,
   communication, and leadership.
3. Scale and history: 100+ years, many countries, members, and clubs.
4. Three Toastmasters keywords:
   - Network
   - Public Speaking
   - Leadership

Visual treatment:

- A world-scale wall: map, network points, and large numeric markers.
- A "100 years" emblem or historical marker.
- A large club/member/country data wall.
- Three featured exhibit clusters for Network, Public Speaking, and Leadership.

Room 1 should feel broader and more institutional. It can use generated or
graphic visuals where real SoarHigh photos are not the right source.

### Room 2: SoarHigh Toastmasters Club

Purpose: move from the global organization into the local club story.

Content beats:

1. SoarHigh was established in 2014 by Shenzhen Airline as a corporate club.
2. In 2016, it became a public club open to everyone.
3. In 2024, it became a 100% English-speaking club.
4. It remains the only English-speaking club in Bao'an district.
5. Slogan: "Soarhigh, so high, take me fly!"
6. Three SoarHigh keywords:
   - Family Atmosphere
   - Fun Events
   - Growth
7. Website, mini app, and QR code.
8. Hand off to tonight's Toastmaster.

Visual treatment:

- A timeline wall for 2014 / 2016 / 2024.
- A slogan moment, ideally with a camera lift or forward glide.
- Three real-photo exhibit walls for Family Atmosphere, Fun Events, and Growth.
- A final wall with `soarhigh.top`, mini app, QR codes, and the handoff cue.

Room 2 should feel warmer, more personal, and more photo-heavy than Room 1.

## Exploration Modes

The same content should support three modes.

### Free Explore

The current first-person controls remain useful. Visitors can walk around,
look at exhibits, and click or tap framed images to open details.

This mode is useful before and after the guided presentation, and later for
the broader time-gallery product.

### Step / Remote Mode

The host controls the presentation with a simple next/previous command:

- Space: next step
- ArrowRight / PageDown / presenter remote next: next step
- ArrowLeft / PageUp / presenter remote previous: previous step
- Escape: exit current expanded image or pause guided mode

Each step can move the camera, focus an exhibit, open an image, close an image,
or show a data wall.

This should be the default mode for the 2026-07-01 meeting because it lets the
host adapt to live timing and guest interaction.

### Auto Play

The same steps can play by duration. This is useful for recording, lobby
display, or rehearsal, but it should not be the only live mode.

Auto play should support pause/resume and should not prevent manual override.

## Exhibit Types

The current project has wall-mounted square frames with generated abstract
textures. The Club Introduction Wing needs richer exhibit types:

- Photo frame: real photo, title, caption, and optional meeting source.
- Poster frame: meeting poster, usually taller or larger than square photos.
- Data plaque: large number plus short label.
- Keyword cluster: one keyword with several supporting photos.
- Timeline card: year, short label, and optional image.
- Map/network wall: graphic visual for Toastmasters scale and network.
- QR / link wall: website, mini app, QR codes, and short CTA.
- Slogan sign: large theatrical text moment.

Each exhibit should be usable both by free exploration and by guided camera
steps.

## Photo Selection Strategy

Do not download all assets blindly. First build a curated asset list.

Candidate mappings:

- Network: group photos, dining, joint meetings, member days, guest
  interactions, cross-club photos.
- Public Speaking: stage shots, speaker closeups, table topics, debate arena,
  workshop teaching, microphone scenes.
- Leadership: officer elections, hosts, SAA/TOM/Timer roles, meeting
  organization, awards, team coordination.
- Family Atmosphere: warm group photos, tea break, shared meals, encouraging
  moments, casual smiles.
- Fun Events: Halloween, Christmas, speed dating, outings, games, special
  themed meetings.
- Growth: first speeches, prepared speeches, evaluations, workshop learning,
  awards, before/after progress moments.

Preferred workflow:

1. Query meeting metadata from `soarhigh.top/meetings`.
2. Shortlist candidate meetings by theme and date.
3. Pull media metadata for those meetings.
4. Manually choose a small curated set for this wing.
5. Save only selected assets locally for reliable presentation.

The first demo likely needs 18-30 selected visuals, not hundreds:

- 3-5 international/data visuals.
- 3 Toastmasters keyword visuals.
- 3 SoarHigh history/timeline visuals.
- 9-15 SoarHigh keyword photos.
- 2-4 final CTA/QR/website assets.

Suggested asset manifest shape:

```ts
interface ClubIntroAsset {
  id: string;
  kind: 'photo' | 'poster' | 'graphic' | 'qr' | 'logo';
  title: string;
  role:
    | 'toastmasters-scale'
    | 'network'
    | 'public-speaking'
    | 'leadership'
    | 'soarhigh-history'
    | 'family'
    | 'fun'
    | 'growth'
    | 'final-cta';
  sourceUrl?: string;
  localPath?: string;
  meetingNo?: number;
  meetingTheme?: string;
  caption?: string;
  credit?: string;
}
```

For implementation, every exhibit should reference an `asset.id`, never a raw
URL scattered across scene-building code.

## Camera Tour Model

The implementation should introduce a tour-step data model instead of hard
coding camera logic into event handlers.

Suggested shape:

```ts
interface TourStep {
  id: string;
  roomId: string;
  title: string;
  spokenCue?: string;
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
    durationMs: number;
    easing?: 'linear' | 'easeInOut';
  };
  action?: {
    type: 'focusExhibit' | 'openExhibit' | 'closeExhibit' | 'showOverlay';
    targetId?: string;
  };
  autoDurationMs?: number;
}
```

The important design choice is that guided mode, auto play, and free explore
all use the same exhibit IDs and room layout.

## Current Guided Slice: Toastmasters International

Date: 2026-06-29

The current implementation slice intentionally focuses only on the two
Toastmasters International room walls that already have curated photo
placement. The goal is to prove the guided presentation behavior before
expanding to other walls or the SoarHigh room.

This slice defines two presentation groups. These groups are a presentation
layer only: every wall photo remains an independent exhibit, with its own
click target, image, title, and description.

### Group 1: Meeting and Stage Wall

Exhibits:

- `ti-speaking-first-impression`
- `ti-speaking-2025-winners`

Narrative beats:

1. A common Toastmasters meeting scene.
2. Toastmasters as a nonprofit organization for public speaking,
   communication, and leadership growth.
3. Speech contests and the 2025 winners as the larger stage that regular
   practice can lead to.

Interaction rule:

- The first cue enters the group and opens the first image.
- Internal cues keep the opened presentation surface active.
- The background camera may make a subtle slide, but the foreground photo and
  right-side text switch directly with a small animation.

### Group 2: History and Scale Wall

Exhibits:

- `ti-history-smedley`
- `ti-history-ymca`
- `ti-history-1924-club-meeting`
- `ti-world-map-wall`

Narrative beats:

1. "Where did Toastmasters come from?"
2. Ralph C. Smedley founded Toastmasters in 1924.
3. The early YMCA setting where the idea took shape.
4. An early club meeting scene.
5. The global network: 140+ countries, 15K+ clubs, 280K+ members, and 90+
   clubs in Shenzhen.

Interaction rule:

- Switching from the meeting wall to the history wall is a group-to-group
  camera move.
- Once inside the history group, the opened presentation surface stays active
  while the image and right-side text change.
- The host can advance with Space, ArrowRight, or PageDown once guided mode is
  active, and go back with ArrowLeft or PageUp.

Suggested JSON-like shape used by the implementation:

```ts
interface PresentationGroup {
  id: string;
  title: string;
  roomIdx: number;
  exhibitIds: string[];
}

interface PresentationCue {
  id: string;
  groupId: string;
  exhibitId: string;
  title: string;
  desc: string;
  spokenCue: string;
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
    durationMs: number;
  };
  transition?: 'group-start' | 'group-slide' | 'group-switch';
}
```

## Current Codebase Implications

The current project is already a useful prototype, but it is organized around
a hard-coded generic gallery. The Club Introduction Wing should extend it
deliberately instead of burying more one-off logic in the existing modules.

Current responsibilities:

- `src/data.ts`: hard-coded room metadata, photo metadata, room plan, and
  room connections.
- `src/gallery.ts`: builds rooms, corridors, frames, trims, lights, decor,
  dust, and global arrays such as `frameMeshes`, `roomRects`,
  `corridorRects`, and `occluderMeshes`.
- `src/controls.ts`: owns first-person controls, touch controls, center
  raycast hit testing, crosshair state, and the photo popup.
- `src/materials.ts`: generates current procedural canvas textures for art,
  walls, floors, plaques, and signs.
- `src/app.ts`: owns the animation loop, movement, collision, minimap update,
  dust animation, and render call.
- `src/ui.ts`: owns the minimap and current-room label.

Required architectural shifts:

- Move Club Introduction content into structured data, not scattered
  conditionals.
- Keep frame/exhibit registration explicit so raycasting and guided steps can
  address exhibits by ID.
- Add real image texture loading while preserving procedural placeholders.
- Add a guided-tour controller that can temporarily own the camera without
  destroying free-explore controls.
- Keep collision and minimap data generated from the same room/corridor plan.

Suggested new or changed files:

- `src/clubIntroData.ts`: room, exhibit, and tour-step content for this wing.
- `src/exhibits.ts`: builders for photo frames, poster frames, data plaques,
  keyword clusters, timeline cards, map/network walls, and QR/link walls.
- `src/tour.ts`: step state, camera interpolation, next/previous/autoplay,
  and exhibit actions.
- `src/assets.ts`: image loading helpers and fallback texture helpers.
- `src/gallery.ts`: should become more generic over room/exhibit data, or
  delegate Club Introduction construction to a dedicated builder.
- `src/controls.ts`: should expose open/close exhibit behavior so tour actions
  and free-click behavior share the same presentation surface.

The first implementation should avoid a full rewrite. A pragmatic path is to
add the Club Introduction Wing as a dedicated builder, then extract shared
builders only when the duplication becomes real.

## Current UX Audit: 2026-06-29

The first working implementation proved the technical direction, but the
experience is not yet acceptable as a designed 3D presentation. The current
version feels like PPT cards placed inside a 3D room rather than a curated
gallery tour. The following issues must be fixed before treating the wing as
presentation-ready.

### Spatial and Camera Issues

- The guided camera path behaves like teleporting between fixed viewpoints,
  not like a rail-guided museum walk. Adjacent steps jump across opposite
  walls, rotate abruptly, or move too close to wall graphics.
- The transition from the Toastmasters room to the SoarHigh room is broken:
  the camera can move into the Toastmasters data wall and show a giant clipped
  `80+ clubs in Shenzhen` texture instead of walking through the connector.
- Large signs and hanging plaques block key sightlines. The Toastmasters room
  sign competes with the main exhibit, and the black back side of another sign
  dominates the view when entering the SoarHigh room.
- The exhibit placement does not support the tour order. Family / Fun /
  Growth and the Toastmasters keywords are distributed in a way that forces
  back-and-forth camera jumps rather than a coherent left-to-right or
  forward-moving route.
- Decorative furniture and props are not curated. Tables, abstract sculptures,
  plants, and benches currently feel like generic filler and sometimes block
  the camera or attention.

### Exhibit and Content Issues

- Frames contain too much text. In this experience, wall frames should mostly
  contain photos, posters, or visual artifacts. Detailed text should appear
  only after the frame is opened or in a subtle nearby label.
- Several exhibits are pure text cards, especially the Toastmasters data wall,
  `Practice, Feedback, Growth`, the slogan card, and the final website card.
  This makes the room feel like a slide deck instead of a gallery.
- `Practice, Feedback, Growth` is not a required narrative beat from the
  provided Club Introduction script. It distracts from the clearer first-room
  structure: Toastmasters identity, scale, and the three keywords.
- The SoarHigh slogan should be a spatial/atmospheric moment, not a framed
  zoomable text card.
- The final CTA currently loses its purpose when opened: the wall shows QR
  codes, but the expanded view becomes a text card. The expanded CTA must keep
  QR codes large and scannable.

### Photo and Concept Fit

Photo selection remains a separate content-curation task. The implementation
should support replacing assets cleanly once the host provides final photos
for each concept. Until then, use plausible placeholders but do not pretend the
current set is final.

Known mismatches in the current asset set:

- SoarHigh History uses a recent AI meeting poster to represent the 2014 /
  2016 / 2024 club history, which is misleading.
- Family Atmosphere reuses the Member Day poster, which is weaker than warm
  candid group, dinner, birthday, support, or laughter photos.
- Growth uses a workshop poster plus a speech photo, but does not yet show a
  real growth arc such as first attempt, feedback, award, or visible progress.
- Network needs photos that clearly show cross-club connection, guests,
  member-day interaction, or people from different backgrounds, not only a
  generic activity poster.
- Toastmasters International concepts can use non-SoarHigh sources, including
  official Toastmasters imagery, public-domain/stock-like meeting visuals, or
  generated/graphic visuals when real photos are not available.

### Interaction and Visual Design Issues

- The expanded exhibit view behaves like a generic image previewer. It should
  feel like a selected exhibit coming forward: large photo first, explanation
  second.
- Expanded images are often too small inside a dark card, especially posters.
  The active image should use most available space while preserving aspect
  ratio and readability.
- Multi-image exhibits have no hierarchy. A concept should have one primary
  image; secondary images can appear as supporting thumbnails or subsequent
  beats.
- Typography feels heavy and unpolished: many large white bold labels,
  repeated black plaques, colorful borders, and chip labels compete with one
  another.
- The color system is noisy. Blue, green, purple, orange, pink, teal, yellow,
  and black are all dominant in different places. Each room needs a controlled
  palette and a small set of accent colors.
- Text readability is inconsistent. Small text on 3D panels is not useful from
  presentation distance, while enlarged text often feels crude.
- The HUD is functional but visually separate from the exhibition. It should be
  subtle, aligned with the room style, and should not fight the exhibit.

### Repair Principles

- Treat the room as a curated exhibition, not a slide deck.
- Make every guided step correspond to one clear visual subject.
- Keep wall frames photo-first. Use short labels only on the wall; reserve
  explanatory text for the opened state.
- Build a real camera path through the space: approach, focus, open, close,
  move on. Avoid large lateral jumps between adjacent steps.
- Keep the walking corridor and doorway visually clear.
- Use a smaller number of stronger exhibits instead of many text-heavy panels.
- Leave final photo choices swappable through structured asset IDs.
- Validate by repeatedly running the whole flow in Chrome from step 1 to the
  final handoff, not by only checking that the scene renders.

## First Demo Route

The current implemented route is the Toastmasters International two-wall
slice:

1. Common Toastmasters meeting scene.
2. Toastmasters as a nonprofit organization for public speaking,
   communication, and leadership.
3. 2025 contest winners as the larger stage.
4. Ralph C. Smedley and the 1924 founding.
5. YMCA roots.
6. Early club meeting scene.
7. Global network and Shenzhen scale.

The broader draft route for the full 2026-07-01 version remains:

1. Entrance: "Toastmasters International"
2. Data wall: "100+ years"
3. Data wall: countries, members, clubs
4. Shenzhen clubs data point
5. Network exhibit opens
6. Public Speaking exhibit opens
7. Leadership exhibit opens
8. Walk through connector into SoarHigh room
9. 2014 timeline card opens
10. 2016 timeline card opens
11. 2024 timeline card opens
12. Slogan moment
13. Family Atmosphere wall opens
14. Fun Events wall opens
15. Growth wall opens
16. Website / mini app / QR wall
17. Final handoff to tonight's Toastmaster

This route should be short enough for a 3-4 minute live Club Introduction.

## Proposed First Demo Defaults

These defaults are proposed unless the host decides otherwise:

- Start directly in Step / Remote mode, with an unobtrusive control hint.
- Keep the four PPT slide boundaries as script references only; organize the
  3D route by room and tour beat.
- Use a shortened 3D-specific script that preserves the original meaning.
- Use the PPT's rounded statistics for the 2026-07-01 live demo, with a small
  internal note to verify official Toastmasters numbers before public reuse.
- Make the Club Introduction Wing the default path for the demo build, while
  preserving the old generic gallery code as fallback during development.
- Localize selected assets before the live demo; do not depend on the
  SoarHigh API during the meeting.

## Requirement Trace

The following checklist is the working contract for the longer implementation
goal.

- Two connected small rooms exist as a distinct wing.
- Room 1 covers Toastmasters International identity, scale/history, and the
  Network / Public Speaking / Leadership keywords.
- Room 2 covers SoarHigh history, slogan, Family Atmosphere / Fun Events /
  Growth keywords, and final website/QR handoff.
- The same exhibits can be used in Free Explore, Step / Remote, and Auto Play.
- Free Explore retains keyboard, mouse, and touch navigation.
- Step / Remote mode supports next/previous controls suitable for a presenter
  remote.
- Auto Play uses the same tour steps and supports pause/resume or manual
  interruption.
- Real photos can be displayed in frames or expanded views.
- Procedural placeholders remain available when an asset is missing.
- The camera path is data-driven enough to tune without rewriting control
  logic.
- The first live demo route can complete in 3-4 minutes.
- No login, upload, deletion, or write-back to SoarHigh is required.

## Implementation Milestones

The long-running goal should progress milestone by milestone. Do not treat a
later implementation slice as complete if it only covers part of the documented
scope. If scope has to be reduced for the 2026-07-01 demo, record the cut
explicitly in this document before building.

### Milestone 1: Requirements and Content Plan

Deliverables:

- This design document.
- A final list of tour beats.
- A first curated asset manifest with local filenames or source URLs.
- Open questions answered enough to build.
- A decision on the first demo defaults above.

No 3D implementation is required in this milestone.

### Milestone 2: Data and Asset Pipeline

Deliverables:

- Add a structured content file for rooms, exhibits, and tour steps.
- Add a curated `public/assets/club-intro/` set.
- Add image-loading support for real textures.
- Preserve generated textures as fallback placeholders.

### Milestone 3: Two-Room Club Introduction Wing

Deliverables:

- Add the Toastmasters room and SoarHigh room.
- Add connector between the rooms.
- Add real exhibit frames, data plaques, timeline cards, and final CTA wall.
- Keep current free exploration working.

### Milestone 4: Guided Presentation Mode

Deliverables:

- Add step controller.
- Add camera interpolation.
- Add open/close exhibit actions.
- Add keyboard/presenter remote controls.
- Add visible but unobtrusive mode state.

### Milestone 5: Auto Play and Rehearsal Polish

Deliverables:

- Add timed playback.
- Add pause/resume.
- Tune camera timing to the host script.
- Verify on the actual presentation machine and display resolution.

## Acceptance Criteria

For the 2026-07-01 demo:

- The app starts directly into or near the Club Introduction Wing.
- The host can finish the whole introduction using only next/previous controls.
- Free exploration still works after guided mode is exited.
- Images are local or otherwise reliable enough for live presentation.
- The camera never clips through walls or points away from the intended exhibit.
- Opened exhibits are readable from projector distance.
- The full guided route fits within 3-4 minutes.
- The final step cleanly hands off to the Toastmaster.

## Open Questions

These are not all blockers. Items marked "default proposed" can proceed with
the proposed answer unless the host changes direction.

1. Should the 2026-07-01 demo start in guided mode automatically, or should it
   show a small mode picker first? Default proposed: start in guided mode.
2. Should we keep the exact four PPT slide boundaries, or reorganize by room
   and tour beat only? Default proposed: organize by room and tour beat.
3. Should the live host script stay exactly as provided, or should we create a
   shorter 3D-specific script? Default proposed: shorten for 3D pacing.
4. Should the international statistics use the PPT's rounded figures or
   updated official Toastmasters numbers? Default proposed: PPT rounded
   figures for the first demo, verified official figures for public reuse.
5. Which QR codes should appear in the final wall, and are the current images
   already available as source files? Blocking before final asset freeze.
6. For the first demo, should the old generic gallery remain accessible, or
   should the Club Introduction Wing be the default/only path? Default
   proposed: Club Introduction Wing is default; old gallery remains fallback.

## Non-Goals for the First Demo

- No full content management editor.
- No automatic import of every past meeting photo.
- No bulk asset download before the curated asset list is agreed.
- No online login or write-back to `soarhigh.top`.
- No full meeting timeline wing yet.
- No need to solve all future exhibition layout problems before the first
  Club Introduction demo.
