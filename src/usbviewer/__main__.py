#!/usr/bin/env python3
"""
跨平台HID设备信息查看工具 - PySide6版本
使用 PySide6 提供现代化的跨平台界面设计
"""

import sys
import platform
from datetime import datetime
from typing import List, Dict, Any
from PySide6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QLabel,
    QProgressBar,
    QDialog,
    QTextEdit,
    QMessageBox,
    QFrame,
    QSplitter,
    QStatusBar,
    QToolBar,
    QGroupBox,
    QSizePolicy,
)
from PySide6.QtCore import (
    Qt,
    QTimer,
    Signal,
    QThread,
    QSize,
    QPropertyAnimation,
    QEasingCurve,
    Property,
)
from PySide6.QtGui import QIcon, QAction, QFont, QColor, QPalette


# 运行时导入HID库
HAS_HID = False
HID_BACKEND_INFO = ""

try:
    import hid

    HAS_HID = True
    HID_BACKEND_INFO = "HID 库已就绪"
except ImportError:
    hid = None
    HID_BACKEND_INFO = "HID 库未安装"


class MessageBox(QWidget):
    """类似 Element UI 的消息提示框"""

    def __init__(self, message: str, msg_type: str = "info", parent=None):
        super().__init__(
            parent, Qt.WindowType.ToolTip | Qt.WindowType.FramelessWindowHint
        )
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)

        self.message = message
        self.msg_type = msg_type
        self._opacity = 1.0

        self.init_ui()

        # 自动关闭定时器
        QTimer.singleShot(3000, self.fade_out)

    def init_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 12, 20, 12)
        layout.setSpacing(12)

        # 图标映射
        icons = {"success": "✅", "info": "ℹ️", "warning": "⚠️", "error": "❌"}

        # 颜色映射
        colors = {
            "success": "#98c379",
            "info": "#61afef",
            "warning": "#e5c07b",
            "error": "#e06c75",
        }

        icon_label = QLabel(icons.get(self.msg_type, "ℹ️"))
        icon_font = QFont("Segoe UI Emoji", 18)
        icon_label.setFont(icon_font)
        icon_label.setStyleSheet("border: none;")
        layout.addWidget(icon_label)

        msg_label = QLabel(self.message)
        msg_font = QFont("Microsoft YaHei UI", 11)
        msg_font.setWeight(QFont.Weight.Medium)
        msg_label.setFont(msg_font)
        msg_label.setStyleSheet("color: #abb2bf; border: none;")
        layout.addWidget(msg_label)

        # 设置样式
        color = colors.get(self.msg_type, "#61afef")
        self.setStyleSheet(
            f"""
            QWidget {{
                background-color: #1e2127;
                border: 2px solid {color};
                border-radius: 10px;
            }}
        """
        )

        self.adjustSize()

    def fade_out(self):
        """淡出动画"""
        self.animation = QPropertyAnimation(self, b"windowOpacity")
        self.animation.setDuration(300)
        self.animation.setStartValue(1.0)
        self.animation.setEndValue(0.0)
        self.animation.setEasingCurve(QEasingCurve.Type.InOutQuad)
        self.animation.finished.connect(self.close)
        self.animation.start()

    @staticmethod
    def show_message(message: str, msg_type: str = "info", parent=None):
        """显示消息"""
        msg_box = MessageBox(message, msg_type, parent)

        # 计算位置（屏幕顶部中央）
        if parent:
            parent_rect = parent.geometry()
            x = parent_rect.x() + (parent_rect.width() - msg_box.width()) // 2
            y = parent_rect.y() + 80
        else:
            screen = QApplication.primaryScreen().geometry()
            x = (screen.width() - msg_box.width()) // 2
            y = 80

        msg_box.move(x, y)
        msg_box.show()

        return msg_box


class ScanThread(QThread):
    """后台扫描线程"""

    finished = Signal(list)
    error = Signal(str)

    def __init__(self, viewer):
        super().__init__()
        self.viewer = viewer

    def run(self):
        try:
            devices = self.viewer.scan_usb_devices()
            self.finished.emit(devices)
        except Exception as e:
            self.error.emit(str(e))


class MonitorThread(QThread):
    """设备监控线程"""

    device_changed = Signal(
        int, int, list
    )  # added_count, removed_count, added_device_ids

    def __init__(self, viewer):
        super().__init__()
        self.viewer = viewer
        self.running = True
        self.device_ids = set()

    def run(self):
        import time

        while self.running:
            try:
                time.sleep(2)  # 每2秒检测一次

                if self.viewer.is_scanning:
                    continue

                # 获取当前设备列表
                current_devices = self.viewer.scan_usb_devices()
                current_ids = {self.viewer.get_device_id(d) for d in current_devices}

                # 检测变化
                added = current_ids - self.device_ids
                removed = self.device_ids - current_ids

                if added or removed:
                    self.viewer.devices = current_devices
                    self.device_ids = current_ids
                    self.device_changed.emit(len(added), len(removed), list(added))

            except Exception as e:
                print(f"监控错误: {e}")
                if "shutdown" in str(e).lower() or "closed" in str(e).lower():
                    break

    def stop(self):
        self.running = False


class DeviceDetailsDialog(QDialog):
    """设备详细信息对话框"""

    def __init__(self, device: Dict, parent=None):
        super().__init__(parent)
        self.device = device
        self.setWindowTitle(device.get("product", "设备详情"))
        self.setMinimumSize(700, 600)
        self.init_ui()

    def init_ui(self):
        self.setStyleSheet("QDialog { background-color: #1e2127; }")
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)

        # 标题区域
        title_frame = QFrame()
        title_frame.setStyleSheet(
            """
            QFrame {
                background-color: #282c34;
                border-radius: 10px;
                padding: 18px;
                border: 2px solid #528bff;
            }
        """
        )
        title_layout = QVBoxLayout(title_frame)

        # 蓝牙标识
        bluetooth_prefix = ""
        if self.device.get("is_bluetooth", False):
            bluetooth_prefix = "🔵 [蓝牙HID]  "

        title_label = QLabel(f"{bluetooth_prefix}📱 {self.device.get('product', '未知设备')}")
        title_font = QFont("Microsoft YaHei UI", 16)
        title_font.setWeight(QFont.Weight.Bold)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #61afef; border: none;")
        title_layout.addWidget(title_label)

        vendor_label = QLabel(f"🏢 {self.device.get('vendor', '未知厂商')}")
        vendor_font = QFont("Microsoft YaHei UI", 12)
        vendor_font.setWeight(QFont.Weight.Medium)
        vendor_label.setFont(vendor_font)
        vendor_label.setStyleSheet("color: #abb2bf; border: none;")
        title_layout.addWidget(vendor_label)

        layout.addWidget(title_frame)

        # 识别信息区域
        info_group = QGroupBox("🆔 识别信息")
        info_group_font = QFont("Microsoft YaHei UI", 13)
        info_group_font.setWeight(QFont.Weight.Bold)
        info_group.setFont(info_group_font)
        info_group.setStyleSheet(
            """
            QGroupBox {
                border: 2px solid #3e4451;
                border-radius: 10px;
                margin-top: 12px;
                padding-top: 12px;
                background-color: #282c34;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                subcontrol-position: top left;
                padding: 6px 12px;
                color: #61afef;
            }
            QLabel {
                color: #abb2bf;
                border: none;
            }
        """
        )
        info_layout = QVBoxLayout()
        info_layout.setSpacing(10)

        vid_label = QLabel(f"<b>VID:</b> {self.device.get('vid', '未知')}")
        vid_font = QFont("Microsoft YaHei UI", 11)
        vid_label.setFont(vid_font)
        info_layout.addWidget(vid_label)

        pid_label = QLabel(f"<b>PID:</b> {self.device.get('pid', '未知')}")
        pid_font = QFont("Microsoft YaHei UI", 11)
        pid_label.setFont(pid_font)
        info_layout.addWidget(pid_label)

        serial = self.device.get("serial", "N/A")
        serial_label = QLabel(f"<b>序列号:</b> {serial}")
        serial_font = QFont("Microsoft YaHei UI", 11)
        serial_label.setFont(serial_font)
        serial_label.setWordWrap(True)
        info_layout.addWidget(serial_label)

        info_group.setLayout(info_layout)
        layout.addWidget(info_group)

        # 原始数据区域
        raw_group = QGroupBox("📋 原始数据")
        raw_group_font = QFont("Microsoft YaHei UI", 13)
        raw_group_font.setWeight(QFont.Weight.Bold)
        raw_group.setFont(raw_group_font)
        raw_group.setStyleSheet(
            """
            QGroupBox {
                border: 2px solid #3e4451;
                border-radius: 10px;
                margin-top: 12px;
                padding-top: 12px;
                background-color: #282c34;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                subcontrol-position: top left;
                padding: 6px 12px;
                color: #61afef;
            }
        """
        )
        raw_layout = QVBoxLayout()

        text_edit = QTextEdit()
        text_edit.setPlainText(self.device.get("raw_info", "无详细信息"))
        text_edit.setReadOnly(True)
        text_edit_font = QFont("Consolas", 10)
        text_edit.setFont(text_edit_font)
        text_edit.setStyleSheet(
            """
            QTextEdit {
                background-color: #1e2127;
                border: 2px solid #3e4451;
                border-radius: 8px;
                padding: 12px;
                color: #abb2bf;
                line-height: 1.6;
            }
            QTextEdit:focus {
                border: 2px solid #528bff;
            }
        """
        )
        raw_layout.addWidget(text_edit)
        raw_group.setLayout(raw_layout)
        layout.addWidget(raw_group)

        # 按钮区域
        button_layout = QHBoxLayout()
        button_layout.addStretch()

        copy_btn = QPushButton("📋 复制信息")
        copy_btn.setMinimumSize(130, 40)
        copy_btn_font = QFont("Microsoft YaHei UI", 11)
        copy_btn_font.setWeight(QFont.Weight.Bold)
        copy_btn.setFont(copy_btn_font)
        copy_btn.setStyleSheet(
            """
            QPushButton {
                background-color: #61afef;
                color: #1e2127;
                border: none;
                border-radius: 8px;
                padding: 10px 20px;
            }
            QPushButton:hover {
                background-color: #73bcf7;
            }
            QPushButton:pressed {
                background-color: #4fa3e8;
            }
        """
        )
        copy_btn.clicked.connect(self.copy_info)
        button_layout.addWidget(copy_btn)

        close_btn = QPushButton("✖ 关闭")
        close_btn.setMinimumSize(130, 40)
        close_btn_font = QFont("Microsoft YaHei UI", 11)
        close_btn_font.setWeight(QFont.Weight.Bold)
        close_btn.setFont(close_btn_font)
        close_btn.setStyleSheet(
            """
            QPushButton {
                background-color: #5c6370;
                color: #e6e6e6;
                border: none;
                border-radius: 8px;
                padding: 10px 20px;
            }
            QPushButton:hover {
                background-color: #6c6f7c;
            }
            QPushButton:pressed {
                background-color: #4b5263;
            }
        """
        )
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)

        layout.addLayout(button_layout)
        self.setLayout(layout)

    def copy_info(self):
        # 复制完整的原始数据
        details = self.device.get("raw_info", "")
        if not details:
            details = f"""VID: {self.device.get('vid', '未知')}
PID: {self.device.get('pid', '未知')}
供应商: {self.device.get('vendor', '未知')}
产品名称: {self.device.get('product', '未知')}
序列号: {self.device.get('serial', 'N/A')}"""
        QApplication.clipboard().setText(details)
        QMessageBox.information(self, "成功", "已复制到剪贴板")


class USBDeviceViewerPySide(QMainWindow):
    """USB设备查看器主窗口"""

    def __init__(self):
        super().__init__()
        self.devices = []
        self.filtered_devices = []
        self.is_scanning = False
        self.selected_device = None
        self.scan_thread = None
        self.monitor_thread = None
        self.monitoring = False

        # 设置窗口图标
        self.set_window_icon()

        self.init_ui()
        self.init_timer()

        # 显示后端信息
        if HID_BACKEND_INFO:
            print(f"HID 后端状态: {HID_BACKEND_INFO}")

        # 启动时自动扫描
        QTimer.singleShot(500, self.refresh_devices)

    def set_window_icon(self):
        """设置窗口图标"""
        from pathlib import Path

        # 尝试多个可能的图标路径
        icon_paths = []

        # 打包后的路径
        if getattr(sys, "frozen", False):
            base_path = Path(sys.argv[0]).parent
        else:
            base_path = Path(__file__).parent

        icon_paths.extend(
            [
                base_path / "icon.svg",
                base_path / "icon.png",
                base_path / "icon.ico",
                base_path.parent / "icon.svg",  # 项目根目录
                base_path.parent / "icon.png",
                base_path.parent / "icon.ico",
            ]
        )

        # 尝试加载第一个存在的图标
        for icon_path in icon_paths:
            if Path(icon_path).exists():
                self.setWindowIcon(QIcon(str(icon_path)))
                return

    def init_ui(self):
        """初始化用户界面"""
        self.setWindowTitle("USB 设备查看器")
        self.setMinimumSize(1280, 860)

        self.setStyleSheet(
            "QMainWindow { background-color: #1e2127; font-family: 'Microsoft YaHei UI', 'Segoe UI', sans-serif; }"
        )

        # 创建中心部件
        central_widget = QWidget()
        central_widget.setStyleSheet("QWidget { background-color: #1e2127; }")
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(16, 12, 16, 16)
        main_layout.setSpacing(14)

        # 创建工具栏
        self.create_toolbar()

        # 搜索栏和设备计数
        search_layout = QHBoxLayout()
        search_layout.setSpacing(15)

        self.search_field = QLineEdit()
        self.search_field.setPlaceholderText(
            "🔍 搜索设备... (支持VID、PID、供应商、产品名称、序列号)"
        )
        self.search_field.setMinimumHeight(46)
        search_font = QFont("Microsoft YaHei UI", 11)
        self.search_field.setFont(search_font)
        self.search_field.setStyleSheet(
            """
            QLineEdit {
                border: 2px solid #3e4451;
                border-radius: 10px;
                padding: 10px 18px;
                background-color: #282c34;
                color: #e6e6e6;
            }
            QLineEdit:focus {
                border: 2px solid #61afef;
                background-color: #2c313a;
            }
            QLineEdit:hover {
                border: 2px solid #528bff;
                background-color: #252931;
            }
            QLineEdit::placeholder {
                color: #5c6370;
            }
        """
        )
        self.search_field.textChanged.connect(self.filter_devices)
        search_layout.addWidget(self.search_field)

        self.device_count_label = QLabel("📊 设备数: 0")
        count_font = QFont("Microsoft YaHei UI", 13)
        count_font.setWeight(QFont.Weight.Bold)
        self.device_count_label.setFont(count_font)
        self.device_count_label.setStyleSheet(
            """
            QLabel {
                color: #61afef;
                padding: 12px 24px;
                background-color: #282c34;
                border-radius: 10px;
                border: 2px solid #528bff;
            }
        """
        )
        self.device_count_label.setMinimumWidth(160)
        search_layout.addWidget(self.device_count_label)

        main_layout.addLayout(search_layout)

        # 设备列表
        list_group = QGroupBox("📋 设备列表")
        list_group_font = QFont("Microsoft YaHei UI", 14)
        list_group_font.setWeight(QFont.Weight.Bold)
        list_group.setFont(list_group_font)
        list_group.setStyleSheet(
            """
            QGroupBox {
                border: 2px solid #3e4451;
                border-radius: 12px;
                margin-top: 14px;
                padding-top: 14px;
                background-color: #282c34;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                subcontrol-position: top left;
                padding: 6px 16px;
                color: #61afef;
            }
        """
        )
        list_layout = QVBoxLayout()
        list_layout.setContentsMargins(12, 12, 12, 12)

        self.device_list = QListWidget()
        self.device_list.itemDoubleClicked.connect(self.show_device_details)
        self.device_list.setAlternatingRowColors(True)
        list_widget_font = QFont("Microsoft YaHei UI", 10)
        self.device_list.setFont(list_widget_font)
        self.device_list.setStyleSheet(
            """
            QListWidget {
                border: 2px solid #3e4451;
                border-radius: 10px;
                background-color: #1e2127;
                outline: none;
                padding: 4px;
            }
            QListWidget::item {
                padding: 14px;
                border-bottom: 1px solid #2c313a;
                color: #e6e6e6;
                border-radius: 6px;
                margin: 3px;
                background-color: #282c34;
            }
            QListWidget::item:hover {
                background-color: #2c313a;
                color: #61afef;
                border-left: 4px solid #528bff;
            }
            QListWidget::item:selected {
                background-color: #3e4451;
                color: #73bcf7;
                font-weight: 600;
                border-left: 5px solid #528bff;
            }
            QListWidget::item:selected:hover {
                background-color: #4b5263;
            }
        """
        )
        list_layout.addWidget(self.device_list)
        list_group.setLayout(list_layout)
        main_layout.addWidget(list_group)

        # 创建状态栏
        self.create_statusbar()

        # 显示加载状态
        self.show_loading_state()

    def create_toolbar(self):
        """创建工具栏"""
        toolbar = QToolBar()
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(32, 32))
        toolbar_font = QFont("Microsoft YaHei UI", 11)
        toolbar_font.setWeight(QFont.Weight.DemiBold)
        toolbar.setFont(toolbar_font)
        toolbar.setStyleSheet(
            """
            QToolBar {
                background-color: #282c34;
                border-bottom: 3px solid #1e2127;
                padding: 8px;
                spacing: 12px;
            }
            QToolButton {
                background-color: #3e4451;
                border: none;
                border-radius: 8px;
                padding: 10px 18px;
                color: #61afef;
                margin: 3px;
            }
            QToolButton:hover {
                background-color: #4b5263;
                color: #73bcf7;
            }
            QToolButton:pressed {
                background-color: #2c313a;
                color: #61afef;
            }
        """
        )
        self.addToolBar(toolbar)

        # 刷新按钮
        refresh_action = QAction("🔄 刷新设备", self)
        refresh_action.triggered.connect(self.refresh_devices)
        toolbar.addAction(refresh_action)

        toolbar.addSeparator()

        # 复制信息按钮
        copy_action = QAction("📋 复制信息", self)
        copy_action.triggered.connect(self.copy_selected)
        toolbar.addAction(copy_action)

        # 导出数据按钮
        export_action = QAction("💾 导出数据", self)
        export_action.triggered.connect(self.export_all)
        toolbar.addAction(export_action)

        toolbar.addSeparator()

        # 添加弹性空间
        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        toolbar.addWidget(spacer)

        # 监控开关
        monitor_label = QLabel("🔍 自动监控: ")
        monitor_label_font = QFont("Microsoft YaHei UI", 11)
        monitor_label_font.setWeight(QFont.Weight.Bold)
        monitor_label.setFont(monitor_label_font)
        monitor_label.setStyleSheet(
            """
            QLabel {
                color: #abb2bf;
                padding: 6px;
            }
        """
        )
        toolbar.addWidget(monitor_label)

        self.monitor_button = QPushButton("● 运行中")
        self.monitor_button.setCheckable(False)
        self.monitor_button.setEnabled(False)
        self.monitor_button.setMinimumSize(110, 38)
        monitor_btn_font = QFont("Microsoft YaHei UI", 11)
        monitor_btn_font.setWeight(QFont.Weight.Bold)
        self.monitor_button.setFont(monitor_btn_font)
        self.monitor_button.setStyleSheet(
            """
            QPushButton {
                background-color: #98c379;
                color: #1e2127;
                border: none;
                border-radius: 8px;
                padding: 10px 18px;
            }
            QPushButton:disabled {
                background-color: #98c379;
                color: #1e2127;
            }
        """
        )
        toolbar.addWidget(self.monitor_button)

        # 系统信息
        sys_label = QLabel(f"  💻 {platform.system()} {platform.release()}  ")
        sys_font = QFont("Microsoft YaHei UI", 10)
        sys_label.setFont(sys_font)
        sys_label.setStyleSheet(
            """
            QLabel {
                color: #5c6370;
                padding: 6px 12px;
                background-color: #1e2127;
                border-radius: 6px;
            }
        """
        )
        toolbar.addWidget(sys_label)

    def create_statusbar(self):
        """创建状态栏"""
        self.statusbar = QStatusBar()
        statusbar_font = QFont("Microsoft YaHei UI", 10)
        self.statusbar.setFont(statusbar_font)
        self.statusbar.setStyleSheet(
            """
            QStatusBar {
                background-color: #282c34;
                border-top: 3px solid #1e2127;
                padding: 8px;
            }
            QStatusBar::item {
                border: none;
            }
        """
        )
        self.setStatusBar(self.statusbar)

        self.status_label = QLabel("✅ 就绪")
        status_font = QFont("Microsoft YaHei UI", 11)
        status_font.setWeight(QFont.Weight.DemiBold)
        self.status_label.setFont(status_font)
        self.status_label.setStyleSheet(
            """
            QLabel {
                color: #e6e6e6;
                padding: 6px 12px;
                background-color: transparent;
            }
        """
        )
        self.statusbar.addWidget(self.status_label)

        self.progress_bar = QProgressBar()
        self.progress_bar.setMaximumWidth(260)
        self.progress_bar.setMinimumHeight(24)
        progress_font = QFont("Microsoft YaHei UI", 10)
        self.progress_bar.setFont(progress_font)
        self.progress_bar.setStyleSheet(
            """
            QProgressBar {
                border: 2px solid #3e4451;
                border-radius: 8px;
                text-align: center;
                background-color: #1e2127;
                color: #e6e6e6;
            }
            QProgressBar::chunk {
                background-color: #61afef;
                border-radius: 6px;
            }
        """
        )
        self.progress_bar.setVisible(False)
        self.statusbar.addPermanentWidget(self.progress_bar)

    def init_timer(self):
        """初始化定时器,启动监控"""
        QTimer.singleShot(1000, self.start_monitoring)

    def show_loading_state(self):
        """显示加载状态"""
        self.device_list.clear()
        item = QListWidgetItem("⏳ 正在扫描设备,请稍候...")
        item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        font = QFont("Microsoft YaHei UI", 14)
        font.setWeight(QFont.Weight.Bold)
        item.setFont(font)
        item.setForeground(QColor("#61afef"))
        self.device_list.addItem(item)

    def refresh_devices(self):
        """刷新设备列表"""
        if self.is_scanning:
            return

        self.is_scanning = True
        self.status_label.setText("扫描中...")
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)  # 不确定进度

        # 启动扫描线程
        self.scan_thread = ScanThread(self)
        self.scan_thread.finished.connect(self.on_scan_finished)
        self.scan_thread.error.connect(self.on_scan_error)
        self.scan_thread.start()

    def on_scan_finished(self, devices):
        """扫描完成回调"""
        self.devices = devices
        self.filtered_devices = self.devices.copy()
        self.is_scanning = False
        self.progress_bar.setVisible(False)
        self.status_label.setText(f"就绪 - 已找到 {len(self.devices)} 个设备")
        self.update_device_list()

    def on_scan_error(self, error_msg):
        """扫描错误回调"""
        self.is_scanning = False
        self.progress_bar.setVisible(False)
        self.status_label.setText(f"扫描失败: {error_msg}")
        self.device_list.clear()
        item = QListWidgetItem(f"❌ 扫描失败: {error_msg}")
        item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        font = QFont()
        font.setPointSize(12)
        item.setFont(font)
        item.setForeground(QColor("#e06c75"))
        self.device_list.addItem(item)

    def is_bluetooth_device(self, device_dict: Dict) -> bool:
        """判断是否为蓝牙HID设备"""
        # 检查产品名称中是否包含蓝牙相关关键词
        product = (device_dict.get("product_string") or "").lower()
        manufacturer = (device_dict.get("manufacturer_string") or "").lower()

        bluetooth_keywords = ["bluetooth", "bt", "蓝牙", "wireless", "无线"]
        for keyword in bluetooth_keywords:
            if keyword in product or keyword in manufacturer:
                return True

        # 检查常见蓝牙适配器VID
        # 0x0A12 - CSR (Cambridge Silicon Radio)
        # 0x8087 - Intel Bluetooth
        # 0x0CF3 - Qualcomm Atheros
        # 0x0930 - Toshiba Bluetooth
        # 0x0489 - Foxconn Bluetooth
        # 0x04CA - Lite-On Technology Bluetooth
        bluetooth_vids = [0x0A12, 0x8087, 0x0CF3, 0x0930, 0x0489, 0x04CA]
        vendor_id = device_dict.get("vendor_id", 0)
        if vendor_id in bluetooth_vids:
            return True

        # 检查路径中是否包含蓝牙标识
        path = str(device_dict.get("path", "")).lower()
        if "bluetooth" in path or "bth" in path:
            return True

        return False

    def process_hid_device(self, device_dict: Dict) -> Dict[str, Any]:
        """处理单个HID设备信息"""
        device: Dict[str, Any] = {}

        # 基本信息
        device["vid"] = f"{device_dict.get('vendor_id', 0):04X}"
        device["pid"] = f"{device_dict.get('product_id', 0):04X}"

        # HID库直接提供字符串信息，无需复杂处理
        device["vendor"] = device_dict.get("manufacturer_string") or "未知"
        device["product"] = device_dict.get("product_string") or "未知"
        device["serial"] = device_dict.get("serial_number") or "N/A"

        # 标识是否为蓝牙设备
        device["is_bluetooth"] = self.is_bluetooth_device(device_dict)

        # 构建详细信息
        raw_info = []
        raw_info.append(f"供应商ID: {device['vid']}")
        raw_info.append(f"产品ID: {device['pid']}")
        raw_info.append(f"制造商: {device['vendor']}")
        raw_info.append(f"产品: {device['product']}")
        raw_info.append(f"序列号: {device['serial']}")
        if device["is_bluetooth"]:
            raw_info.append(f"连接类型: 🔵 蓝牙HID设备")
        raw_info.append(f"路径: {device_dict.get('path', 'N/A')}")
        raw_info.append(f"接口号: {device_dict.get('interface_number', 'N/A')}")
        raw_info.append(f"使用页: 0x{device_dict.get('usage_page', 0):04X}")
        raw_info.append(f"使用ID: 0x{device_dict.get('usage', 0):04X}")
        raw_info.append(f"发行版本: {device_dict.get('release_number', 0)}")

        device["raw_info"] = "\n".join(raw_info)
        return device

    def scan_hid_devices(self) -> List[Dict]:
        """使用HID库扫描设备"""
        devices = []

        if not HAS_HID or hid is None:
            return devices

        try:
            # 枚举所有HID设备
            device_list = hid.enumerate()

            if not device_list:
                return devices

            # 处理每个设备
            for dev_dict in device_list:
                try:
                    device = self.process_hid_device(dev_dict)
                    devices.append(device)
                except Exception as e:
                    print(f"处理设备时出错: {e}")

        except Exception as e:
            print(f"HID扫描错误: {e}")

        devices = self.filter_and_deduplicate_devices(devices)
        return devices

    def filter_and_deduplicate_devices(self, devices: List[Dict]) -> List[Dict]:
        """去除重复和无效设备"""
        if not devices:
            return devices

        valid_devices = []
        for device in devices:
            vid = device.get("vid", "0000")
            pid = device.get("pid", "0000")

            if vid == "0000" and pid == "0000":
                continue

            valid_devices.append(device)

        seen = {}
        unique_devices = []

        for device in valid_devices:
            key = f"{device.get('vid', '')}:{device.get('pid', '')}:{device.get('serial', '')}"

            if key not in seen:
                seen[key] = True
                unique_devices.append(device)

        return unique_devices

    def scan_usb_devices(self) -> List[Dict]:
        """扫描HID设备"""
        if not HAS_HID:
            print("错误: HID库未安装,请运行 pip install hid")
            return []

        return self.scan_hid_devices()

    def update_device_list(self, highlight_device_ids=None):
        """更新设备列表显示

        Args:
            highlight_device_ids: 需要高亮显示的设备ID列表
        """
        self.device_list.clear()

        if not self.filtered_devices:
            item = QListWidgetItem("🔌 未找到HID设备\n\n请连接HID设备后点击刷新按钮")
            item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            font = QFont("Microsoft YaHei UI", 13)
            font.setWeight(QFont.Weight.Bold)
            item.setFont(font)
            item.setForeground(QColor("#5c6370"))
            self.device_list.addItem(item)
        else:
            first_highlight_item = None
            for idx, device in enumerate(self.filtered_devices, 1):
                product = device.get("product", "未知设备")
                vendor = device.get("vendor", "未知厂商")
                vid = device.get("vid", "?")
                pid = device.get("pid", "?")
                serial = device.get("serial", "")
                device_id = self.get_device_id(device)
                is_bluetooth = device.get("is_bluetooth", False)

                # 检查是否需要高亮
                is_highlighted = (
                    highlight_device_ids and device_id in highlight_device_ids
                )

                # 为新插入的设备添加高对比度NEW标记
                new_badge = ""
                if is_highlighted:
                    new_badge = "🟢 [NEW]  "

                # 为蓝牙设备添加标识
                bluetooth_badge = ""
                if is_bluetooth:
                    bluetooth_badge = "🔵 [蓝牙]  "

                display_text = (
                    f"{new_badge}{bluetooth_badge}📱 {product}\n"
                    f"   🏢 {vendor}\n"
                    f"   🆔 VID: {vid}  •  PID: {pid}"
                )
                if serial and serial != "N/A":
                    display_text += f"  •  S/N: {serial[:16]}..."

                item = QListWidgetItem(display_text)
                item.setData(Qt.ItemDataRole.UserRole, device)
                font = QFont("Microsoft YaHei UI", 10)
                if is_highlighted:
                    font.setWeight(QFont.Weight.Bold)
                item.setFont(font)

                # 为高亮设备设置高对比度的亮绿色背景和文字
                if is_highlighted:
                    item.setBackground(QColor("#0d2818"))
                    item.setForeground(QColor("#00ff7f"))
                    if first_highlight_item is None:
                        first_highlight_item = item

                self.device_list.addItem(item)

            # 选中并滚动到第一个高亮的设备
            if first_highlight_item:
                self.device_list.setCurrentItem(first_highlight_item)
                self.device_list.scrollToItem(
                    first_highlight_item, QListWidget.ScrollHint.PositionAtCenter
                )

        self.device_count_label.setText(f"📊 设备数: {len(self.filtered_devices)}")

    def filter_devices(self):
        """过滤设备列表"""
        search_text = self.search_field.text().lower()

        if not search_text:
            self.filtered_devices = self.devices.copy()
        else:
            self.filtered_devices = [
                device
                for device in self.devices
                if search_text in str(device.get("vid", "")).lower()
                or search_text in str(device.get("pid", "")).lower()
                or search_text in str(device.get("vendor", "")).lower()
                or search_text in str(device.get("product", "")).lower()
                or search_text in str(device.get("serial", "")).lower()
            ]

        self.update_device_list()

    def show_device_details(self, item):
        """显示设备详细信息"""
        device = item.data(Qt.ItemDataRole.UserRole)
        if device:
            self.selected_device = device
            dialog = DeviceDetailsDialog(device, self)
            dialog.exec()

    def copy_selected(self):
        """复制选中的设备信息"""
        current_item = self.device_list.currentItem()
        if current_item:
            device = current_item.data(Qt.ItemDataRole.UserRole)
            if device:
                # 复制完整的原始数据
                details = device.get("raw_info", "")
                if not details:
                    details = f"""VID: {device.get('vid', '未知')}
                    PID: {device.get('pid', '未知')}
                    供应商: {device.get('vendor', '未知')}
                    产品名称: {device.get('product', '未知')}
                    序列号: {device.get('serial', 'N/A')}"""
                QApplication.clipboard().setText(details)
                self.status_label.setText("✅ 已复制到剪贴板")
                MessageBox.show_message("已复制到剪贴板", "success", self)
        else:
            QMessageBox.warning(self, "警告", "请先选择一个设备")

    def export_all(self):
        """导出所有设备信息"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"usb_devices_{timestamp}.txt"

        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"USB 设备列表\n")
                f.write(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"系统信息: {platform.system()} {platform.release()}\n")
                f.write(f"{'=' * 80}\n\n")

                for idx, device in enumerate(self.devices, 1):
                    f.write(f"设备 #{idx}\n")
                    # 导出完整的原始数据
                    raw_info = device.get("raw_info", "")
                    if raw_info:
                        f.write(f"{raw_info}\n")
                    else:
                        f.write(f"VID: {device.get('vid', '未知')}\n")
                        f.write(f"PID: {device.get('pid', '未知')}\n")
                        f.write(f"供应商: {device.get('vendor', '未知')}\n")
                        f.write(f"产品: {device.get('product', '未知')}\n")
                        f.write(f"序列号: {device.get('serial', 'N/A')}\n")
                    f.write(f"{'-' * 80}\n\n")

            self.status_label.setText(f"✅ 已导出到 {filename}")
            MessageBox.show_message(f"已导出到 {filename}", "success", self)
        except Exception as e:
            self.status_label.setText(f"❌ 导出失败: {e}")
            MessageBox.show_message(f"导出失败: {e}", "error", self)

    def get_device_id(self, device: Dict) -> str:
        """生成设备唯一标识"""
        return f"{device.get('vid', '')}:{device.get('pid', '')}:{device.get('serial', '')}"

    def start_monitoring(self):
        """启动设备监控"""
        if not HAS_HID or self.monitoring:
            return

        self.monitoring = True
        self.monitor_thread = MonitorThread(self)
        self.monitor_thread.device_ids = {self.get_device_id(d) for d in self.devices}
        self.monitor_thread.device_changed.connect(self.on_device_changed)
        self.monitor_thread.start()
        self.status_label.setText("🔄 已启动自动监控")

    def stop_monitoring(self):
        """停止设备监控"""
        if self.monitor_thread:
            self.monitoring = False
            self.monitor_thread.stop()
            self.monitor_thread.wait()
            self.monitor_thread = None

    def on_device_changed(self, added_count, removed_count, added_device_ids):
        """设备变化回调"""
        # 更新过滤后的设备列表
        if self.search_field.text():
            self.filter_devices()
        else:
            self.filtered_devices = self.devices.copy()

        # 传递新增设备ID以高亮显示
        self.update_device_list(
            highlight_device_ids=added_device_ids if added_count > 0 else None
        )

        # 显示通知
        if added_count > 0 and removed_count > 0:
            message = f"检测到 {added_count} 个新设备，移除了 {removed_count} 个设备"
            self.status_label.setText(f"🔌 {message}")
            MessageBox.show_message(message, "info", self)
        elif added_count > 0:
            message = f"检测到 {added_count} 个新设备"
            self.status_label.setText(f"🔌 {message}")
            MessageBox.show_message(message, "success", self)
        elif removed_count > 0:
            message = f"移除了 {removed_count} 个设备"
            self.status_label.setText(f"🔌 {message}")
            MessageBox.show_message(message, "warning", self)

    def closeEvent(self, event):
        """窗口关闭事件"""
        self.stop_monitoring()
        event.accept()


def main():
    """主函数"""
    app = QApplication(sys.argv)
    app.setApplicationName("USB 设备查看器")
    app.setOrganizationName("USB Viewer Team")

    # 设置应用样式
    app.setStyle("Fusion")

    window = USBDeviceViewerPySide()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
