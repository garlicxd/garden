import unicodedata
from fabric import Application
from collections.abc import Iterator
from fabric.widgets.box import Box
from fabric.widgets.entry import Entry
from fabric.widgets.label import Label
from fabric.widgets.button import Button
from fabric.widgets.window import Window
from fabric.widgets.flowbox import FlowBox
from fabric.widgets.scrolledwindow import ScrolledWindow
from fabric.utils import idle_add, remove_handler

import pyperclip  # For clipboard functionality


class EmojiPicker(Window):
    def __init__(self, **kwargs):
        super().__init__(
            layer="top",
            anchor="center",
            exclusivity="none",
            keyboard_mode="on-demand",
            visible=False,
            all_visible=False,
            on_destroy=lambda *_: app.quit(),
            **kwargs,
        )
        self._arranger_handler: int = 0

        # Load all emojis with their names
        self._all_emojis = self.load_emoji_data()

        self.viewport = FlowBox(orientation="v")
        self.search_entry = Entry(
            placeholder="Search Emojis...",
            h_expand=True,
            notify_text=lambda entry, *_: self.arrange_viewport(entry.get_text()),
        )
        self.scrolled_window = ScrolledWindow(
            min_content_size=(280, 320), child=self.viewport
        )

        self.add(
            Box(
                spacing=2,
                orientation="v",
                style="margin: 2px",
                children=[
                    # Header with search entry
                    Box(
                        spacing=2,
                        orientation="h",
                        children=[
                            self.search_entry,
                            Button(
                                image=Label(text="❌"),  # Close button with emoji
                                tooltip_text="Exit",
                                on_clicked=lambda *_: self.application.quit(),
                            ),
                        ],
                    ),
                    # Slots holder
                    self.scrolled_window,
                ],
            )
        )
        self.arrange_viewport()
        self.show_all()

    def load_emoji_data(self):
        """Load emojis from Unicode data."""
        emoji_data = {}
        for codepoint in range(0x1F300, 0x1FAFF):  # Emoji range in Unicode
            try:
                char = chr(codepoint)
                name = unicodedata.name(char)
                emoji_data[char] = name
            except ValueError:
                continue
        return emoji_data

    def arrange_viewport(self, query: str = ""):
        if self._arranger_handler:
            remove_handler(self._arranger_handler)

        self.viewport.children = []
        self._arranger_handler = idle_add(
            self.add_next_emoji,
            iter(
                sorted(
                    (emoji, name)
                    for emoji, name in self._all_emojis.items()
                    if query.casefold() in name.casefold()
                )
            ),
            pin=True,
        )

        return False

    def add_next_emoji(self, emoji_iter: Iterator[tuple[str, str]]):
        if not (emoji_data := next(emoji_iter, None)):
            return False

        emoji, name = emoji_data
        self.viewport.add(
            Button(
                child=Label(text=emoji, size=32, h_align="center"),
                tooltip_text=name,
                on_clicked=lambda button, *_: self.select_emoji(button.get_child().text),
            )
        )
        return True

    def select_emoji(self, emoji: str):
        """Handle emoji selection."""
        pyperclip.copy(emoji)  # Copy the emoji to clipboard
        print(f"Selected Emoji: {emoji}")  # Debug/logging
        self.application.quit()


if __name__ == "__main__":
    emoji_picker = EmojiPicker()
    app = Application("emoji-picker", emoji_picker)

    app.run()
