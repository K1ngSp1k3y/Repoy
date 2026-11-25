const patches = [];
let unregisterCommand;

function parseDateToTimestamp(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

export default {
  onLoad() {
    const { findByProps, findByStoreName } = vendetta.metro;
    const { after } = vendetta.patcher;
    const storage = vendetta.plugin?.storage ?? {};
    const { registerCommand } = vendetta.commands;

    storage.customDate ??= "2016-01-01";
    storage.enabled ??= true;

    const UserStore = findByStoreName("UserStore");
    const SnowflakeUtils = findByProps("extractTimestamp");

    if (SnowflakeUtils && typeof SnowflakeUtils.extractTimestamp === "function") {
      patches.push(
        after("extractTimestamp", SnowflakeUtils, ([id], res) => {
          if (!storage.enabled) return res;
          const currentUser = UserStore?.getCurrentUser?.();
          if (currentUser && id === currentUser.id) {
            const ts = parseDateToTimestamp(storage.customDate);
            if (ts !== null) return ts;
          }
          return res;
        })
      );
    }

    unregisterCommand = registerCommand({
      name: "setdate",
      displayName: "setdate",
      description: "Locally change your displayed Discord account creation date (YYYY-MM-DD)",
      displayDescription: "Locally change your displayed Discord account creation date (YYYY-MM-DD)",
      type: 1,
      inputType: 1,
      options: [
        {
          name: "date",
          displayName: "date",
          description: "Date in YYYY-MM-DD format (e.g. 2016-05-13), or 'off' to reset",
          displayDescription: "Date in YYYY-MM-DD format (e.g. 2016-05-13), or 'off' to reset",
          type: 3,
          required: true,
        },
      ],
      execute(args) {
        const input = (args.find((a) => a.name === "date")?.value ?? args[0]?.value ?? "").trim();

        if (input.toLowerCase() === "off" || input.toLowerCase() === "reset") {
          storage.enabled = false;
          return {
            content: "Account creation date spoof disabled. Re-open your profile to see your original date.",
          };
        }

        const ts = parseDateToTimestamp(input);
        if (ts === null) {
          return {
            content: "Invalid date format. Use `YYYY-MM-DD` (for example: `2016-05-13`) or `off`.",
          };
        }

        storage.customDate = input;
        storage.enabled = true;
        const unixSeconds = Math.floor(ts / 1000);

        return {
          content: `Local account creation date updated to **${input}** (<t:${unixSeconds}:D>). Re-open your profile card to refresh it.`,
        };
      },
    });
  },

  onUnload() {
    for (const unpatch of patches) {
      try {
        unpatch();
      } catch {}
    }
    patches.length = 0;
    if (unregisterCommand) unregisterCommand();
  },
};
