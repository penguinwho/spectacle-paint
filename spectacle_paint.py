#!/usr/bin/env python3
"""Native Linux window for Spectacle Paint."""
from pathlib import Path
import base64
import sys

from PySide6.QtCore import QObject, QUrl, Qt, Slot
from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication, QFileDialog
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel


class PaintHost(QObject):
    """Connect the period-correct controls in the page to the Linux window."""
    def __init__(self, view: QWebEngineView):
        super().__init__()
        self.view = view

    @Slot()
    def minimize(self) -> None:
        self.view.showMinimized()

    @Slot()
    def toggleMaximize(self) -> None:
        if self.view.isMaximized():
            self.view.showNormal()
        else:
            self.view.showMaximized()

    @Slot()
    def close(self) -> None:
        self.view.close()

    @Slot(str, str, result=bool)
    def savePng(self, data_url: str, suggested_name: str) -> bool:
        """Save the canvas directly, without relying on a browser download."""
        default_path = Path.home() / "Pictures" / suggested_name
        path, _ = QFileDialog.getSaveFileName(
            self.view, "Save As", str(default_path), "PNG image (*.png)"
        )
        if not path:
            return False
        try:
            encoded = data_url.split(",", 1)[1]
            Path(path).write_bytes(base64.b64decode(encoded))
            return True
        except (IndexError, ValueError, OSError):
            return False


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Spectacle Paint")
    app.setOrganizationName("Spectacle Paint")

    app_dir = Path(__file__).resolve().parent
    view = QWebEngineView()
    view.setWindowTitle("Untitled - Paint")
    view.setWindowFlags(Qt.FramelessWindowHint | Qt.Window)
    view.setMinimumSize(850, 560)
    view.resize(1320, 890)
    channel = QWebChannel(view.page())
    host = PaintHost(view)
    channel.registerObject("paintHost", host)
    view.page().setWebChannel(channel)
    view._paint_channel = channel
    view._paint_host = host
    view.setUrl(QUrl.fromLocalFile(str(app_dir / "index.html")))
    view.titleChanged.connect(view.setWindowTitle)
    view.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
