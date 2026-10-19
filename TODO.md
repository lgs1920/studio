Fix Path Widget: bug fixes and interaction updates

1. Preserve dragging when reopening a section

Fix the bug that prevents points from being dragged when a section is edited for the second time. Points must remain
draggable whenever the section is edited.

2. Display all section points

Display every point in the section, including unmodified points.

Mark modified points with a solid chevron in the brand color.

Position this indicator so it straddles the left border of the point’s first input field.

3. Reset and delete shortcuts

When a point’s input field is selected:

Ctrl+R: reset the modification associated with that field.

Delete: mark the corresponding point as deleted.

Deletion must be non-destructive:

Retain the point in the section’s data and keep its row visible but disabled.

Keep its reset action available so the deletion can be undone.

Mark it with a red trash icon, positioned across the left border of the first input field, like the modified-point
chevron.

4. Merge sections regardless of modification status

Section merging must depend on point membership and continuity, regardless of whether any points have been modified.

A section containing no modified points must still participate in merging.

5. Replace the top “Remove” action

Replace the top Remove action with Remove selected points from section.

This action removes the selected points from section membership. It is separate from marking a path point as deleted.

If removing points creates gaps within a section, split the remaining contiguous groups into separate sections.

If no points remain, remove the empty section.

6. Keep the widget open after validation

Clicking Validate must keep the widget open when there are more than two sections.

7. Clarify point and section colors

Use the following visual rules:

Active section: magenta points and a solid magenta path line.

Inactive sections: gray.

Selected points: yellow, taking precedence over the section’s point color.

All point circles must have the same size, regardless of state.

8. Add a global modifications toggle

Add a mode toggle in the widget to enable or disable the application of all modifications.

Enabled: apply all recorded modifications.

Disabled: show the path without applying those modifications.

Preserve all recorded modifications when toggling this mode so they can be enabled again.