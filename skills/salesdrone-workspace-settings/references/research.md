# Research settings

Settings → AvinyaIntelligence → Lead research configures converted/failed/archive-review stage sets, nullable inactivity days, reporting timezone and opt-in indexing. Defaults do not guess stage meanings. Admin + members:write + expectedVersion controls writes; lead readers may read safe configuration. Source/schema/settings changes invalidate old results. Dedicated API ownership is in salesdrone-lead-assistant.

Personal stage grouping remains selectable when stage is hidden in forms; Automatic still uses visible fallback fields. This does not unhide forms or import destinations. Validate stage preferences through dashboardFields with includeHiddenStage:true.
