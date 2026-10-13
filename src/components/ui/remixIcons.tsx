import {forwardRef, type SVGProps} from "react";
import {
    RiAddLine,
    RiAlertLine,
    RiArchiveLine,
    RiArrowDownLine,
    RiArrowDownSLine,
    RiArrowGoBackLine,
    RiArrowGoForwardLine,
    RiArrowLeftLine,
    RiArrowLeftSLine,
    RiArrowRightLine,
    RiArrowRightSLine,
    RiArrowRightUpLine,
    RiArrowUpLine,
    RiArrowUpSLine,
    RiAttachmentLine,
    RiBookOpenLine,
    RiBookShelfLine,
    RiBox3Line,
    RiChat3Line,
    RiChatNewLine,
    RiCheckDoubleLine,
    RiCheckLine,
    RiCheckboxBlankCircleLine,
    RiCheckboxCircleLine,
    RiCheckboxLine,
    RiClapperboardLine,
    RiCloseLine,
    RiCoinsLine,
    RiCollapseDiagonalLine,
    RiDeleteBinLine,
    RiDownloadLine,
    RiDraggable,
    RiEmotionHappyLine,
    RiEqualizerLine,
    RiErrorWarningLine,
    RiExpandDiagonalLine,
    RiExternalLinkLine,
    RiEyeLine,
    RiFileCopy2Line,
    RiFileCopyLine,
    RiFileTextLine,
    RiFilter3Line,
    RiFocus2Line,
    RiFolderLine,
    RiFolderOpenLine,
    RiFullscreenLine,
    RiGroupLine,
    RiHand,
    RiHashtag,
    RiHeadphoneLine,
    RiHeartFill,
    RiHeartLine,
    RiHistoryLine,
    RiImageLine,
    RiInfinityLine,
    RiLayoutColumnLine,
    RiListView,
    RiLoader4Line,
    RiMic2Line,
    RiMicLine,
    RiMoreLine,
    RiMultiImageLine,
    RiMusic2Line,
    RiPauseLine,
    RiPencilLine,
    RiPlayLine,
    RiPlayListLine,
    RiPlugLine,
    RiPrinterLine,
    RiPushpinLine,
    RiQrCodeLine,
    RiQuestionAnswerLine,
    RiQuillPenLine,
    RiRefreshLine,
    RiResetLeftLine,
    RiRestartLine,
    RiScissorsCutLine,
    RiSearchLine,
    RiSettings3Line,
    RiShieldCheckLine,
    RiShieldFlashLine,
    RiShieldKeyholeLine,
    RiSideBarLine,
    RiSidebarFoldLine,
    RiSidebarUnfoldLine,
    RiSkipBackLine,
    RiSkipForwardLine,
    RiSparklingLine,
    RiSpeedUpLine,
    RiStackLine,
    RiStopLine,
    RiSubtractLine,
    RiTShirtLine,
    RiTaskLine,
    RiText,
    RiTodoLine,
    RiToolsLine,
    RiUploadLine,
    RiVideoLine,
    RiVolumeMuteLine,
    RiVolumeUpLine,
    RiZoomInLine,
    RiZoomOutLine,
} from "@remixicon/react";
import type {RemixiconComponentType} from "@remixicon/react";

/** Application-owned general icons. Model/provider marks keep their brand owner. */
type RemixIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
    size?: number | string;
};

/** LobeUI forwards transparent fill and Lucide stroke sizing. Remix's line and
 * fill variants both contain filled paths, so their official geometry owns fill.
 * React 19 forwards the ref through Remix's function component to its SVG. */
function remixIcon(Icon: RemixiconComponentType, mirror = false) {
    return forwardRef<SVGSVGElement, RemixIconProps>(function RemixIcon({
        fill: _fill,
        stroke: _stroke,
        strokeWidth: _strokeWidth,
        strokeLinecap: _strokeLinecap,
        strokeLinejoin: _strokeLinejoin,
        strokeMiterlimit: _strokeMiterlimit,
        strokeDasharray: _strokeDasharray,
        strokeDashoffset: _strokeDashoffset,
        width: _width,
        height: _height,
        viewBox: _viewBox,
        style,
        ...props
    }, ref) {
        return <Icon {...props} ref={ref} style={mirror ? {
            ...style,
            transform: `${style?.transform ? `${style.transform} ` : ""}scaleX(-1)`,
        } : style}/>;
    });
}

// Explicit imports and pure factories let each consumer keep only its glyphs.
export const AlertTriangle = /* @__PURE__ */ remixIcon(RiAlertLine);
export const Archive = /* @__PURE__ */ remixIcon(RiArchiveLine);
export const ArrowDown = /* @__PURE__ */ remixIcon(RiArrowDownLine);
export const ArrowLeft = /* @__PURE__ */ remixIcon(RiArrowLeftLine);
export const ArrowRight = /* @__PURE__ */ remixIcon(RiArrowRightLine);
export const ArrowUp = /* @__PURE__ */ remixIcon(RiArrowUpLine);
export const ArrowUpRight = /* @__PURE__ */ remixIcon(RiArrowRightUpLine);
export const BookOpen = /* @__PURE__ */ remixIcon(RiBookOpenLine);
export const Boxes = /* @__PURE__ */ remixIcon(RiBox3Line);
export const Check = /* @__PURE__ */ remixIcon(RiCheckLine);
export const CheckCheck = /* @__PURE__ */ remixIcon(RiCheckDoubleLine);
export const CheckCircle2 = /* @__PURE__ */ remixIcon(RiCheckboxCircleLine);
export const CheckIcon = /* @__PURE__ */ remixIcon(RiCheckLine);
export const CheckSquare = /* @__PURE__ */ remixIcon(RiCheckboxLine);
export const ChevronDown = /* @__PURE__ */ remixIcon(RiArrowDownSLine);
export const ChevronDownIcon = /* @__PURE__ */ remixIcon(RiArrowDownSLine);
export const ChevronLeft = /* @__PURE__ */ remixIcon(RiArrowLeftSLine);
export const ChevronRight = /* @__PURE__ */ remixIcon(RiArrowRightSLine);
export const ChevronRightIcon = /* @__PURE__ */ remixIcon(RiArrowRightSLine);
export const ChevronUp = /* @__PURE__ */ remixIcon(RiArrowUpSLine);
export const ChevronUpIcon = /* @__PURE__ */ remixIcon(RiArrowUpSLine);
export const Circle = /* @__PURE__ */ remixIcon(RiCheckboxBlankCircleLine);
export const CircleAlert = /* @__PURE__ */ remixIcon(RiErrorWarningLine);
export const Clapperboard = /* @__PURE__ */ remixIcon(RiClapperboardLine);
export const ClipboardCheck = /* @__PURE__ */ remixIcon(RiTaskLine);
export const Coins = /* @__PURE__ */ remixIcon(RiCoinsLine);
export const Columns3 = /* @__PURE__ */ remixIcon(RiLayoutColumnLine);
export const Copy = /* @__PURE__ */ remixIcon(RiFileCopyLine);
export const CopyPlus = /* @__PURE__ */ remixIcon(RiFileCopy2Line);
export const Download = /* @__PURE__ */ remixIcon(RiDownloadLine);
export const Ellipsis = /* @__PURE__ */ remixIcon(RiMoreLine);
export const Expand = /* @__PURE__ */ remixIcon(RiFullscreenLine);
export const ExternalLink = /* @__PURE__ */ remixIcon(RiExternalLinkLine);
export const Eye = /* @__PURE__ */ remixIcon(RiEyeLine);
export const FileText = /* @__PURE__ */ remixIcon(RiFileTextLine);
export const Filter = /* @__PURE__ */ remixIcon(RiFilter3Line);
export const Folder = /* @__PURE__ */ remixIcon(RiFolderLine);
export const FolderOpen = /* @__PURE__ */ remixIcon(RiFolderOpenLine);
export const Gauge = /* @__PURE__ */ remixIcon(RiSpeedUpLine);
export const GripVertical = /* @__PURE__ */ remixIcon(RiDraggable);
export const Hand = /* @__PURE__ */ remixIcon(RiHand);
export const Hash = /* @__PURE__ */ remixIcon(RiHashtag);
export const Headphones = /* @__PURE__ */ remixIcon(RiHeadphoneLine);
export const Heart = /* @__PURE__ */ remixIcon(RiHeartLine);
export const HeartFill = /* @__PURE__ */ remixIcon(RiHeartFill);
export const History = /* @__PURE__ */ remixIcon(RiHistoryLine);
export const Image = /* @__PURE__ */ remixIcon(RiImageLine);
export const ImageIcon = /* @__PURE__ */ remixIcon(RiImageLine);
export const Images = /* @__PURE__ */ remixIcon(RiMultiImageLine);
const InfinityIcon = /* @__PURE__ */ remixIcon(RiInfinityLine);
export {InfinityIcon as Infinity};
export const Layers = /* @__PURE__ */ remixIcon(RiStackLine);
export const Layers3 = /* @__PURE__ */ remixIcon(RiStackLine);
export const LayoutList = /* @__PURE__ */ remixIcon(RiListView);
export const Library = /* @__PURE__ */ remixIcon(RiBookShelfLine);
export const ListMusic = /* @__PURE__ */ remixIcon(RiPlayListLine);
export const ListTodo = /* @__PURE__ */ remixIcon(RiTodoLine);
export const LoaderCircle = /* @__PURE__ */ remixIcon(RiLoader4Line);
export const Maximize2 = /* @__PURE__ */ remixIcon(RiExpandDiagonalLine);
export const MessageSquare = /* @__PURE__ */ remixIcon(RiChat3Line);
export const MessageSquarePlus = /* @__PURE__ */ remixIcon(RiChatNewLine);
export const MessagesSquare = /* @__PURE__ */ remixIcon(RiQuestionAnswerLine);
export const Mic = /* @__PURE__ */ remixIcon(RiMicLine);
export const Mic2 = /* @__PURE__ */ remixIcon(RiMic2Line);
export const Minimize2 = /* @__PURE__ */ remixIcon(RiCollapseDiagonalLine);
export const Minus = /* @__PURE__ */ remixIcon(RiSubtractLine);
export const MoreHorizontal = /* @__PURE__ */ remixIcon(RiMoreLine);
export const Music2 = /* @__PURE__ */ remixIcon(RiMusic2Line);
export const PackageOpen = /* @__PURE__ */ remixIcon(RiBox3Line);
export const PanelLeft = /* @__PURE__ */ remixIcon(RiSideBarLine);
export const PanelLeftClose = /* @__PURE__ */ remixIcon(RiSidebarFoldLine);
export const PanelRightClose = /* @__PURE__ */ remixIcon(RiSidebarFoldLine, true);
export const PanelRightOpen = /* @__PURE__ */ remixIcon(RiSidebarUnfoldLine, true);
export const Paperclip = /* @__PURE__ */ remixIcon(RiAttachmentLine);
export const Pause = /* @__PURE__ */ remixIcon(RiPauseLine);
export const PenLine = /* @__PURE__ */ remixIcon(RiQuillPenLine);
export const Pencil = /* @__PURE__ */ remixIcon(RiPencilLine);
export const Pin = /* @__PURE__ */ remixIcon(RiPushpinLine);
export const Play = /* @__PURE__ */ remixIcon(RiPlayLine);
export const Plug = /* @__PURE__ */ remixIcon(RiPlugLine);
export const Plus = /* @__PURE__ */ remixIcon(RiAddLine);
export const Printer = /* @__PURE__ */ remixIcon(RiPrinterLine);
export const QrCode = /* @__PURE__ */ remixIcon(RiQrCodeLine);
export const Redo2 = /* @__PURE__ */ remixIcon(RiArrowGoForwardLine);
export const RefreshCw = /* @__PURE__ */ remixIcon(RiRefreshLine);
export const Restore = /* @__PURE__ */ remixIcon(RiResetLeftLine);
export const RotateCcw = /* @__PURE__ */ remixIcon(RiRestartLine);
export const Scissors = /* @__PURE__ */ remixIcon(RiScissorsCutLine);
export const Search = /* @__PURE__ */ remixIcon(RiSearchLine);
export const Settings = /* @__PURE__ */ remixIcon(RiSettings3Line);
export const Settings2 = /* @__PURE__ */ remixIcon(RiEqualizerLine);
export const ShieldAlert = /* @__PURE__ */ remixIcon(RiShieldFlashLine);
export const ShieldCheck = /* @__PURE__ */ remixIcon(RiShieldCheckLine);
export const ShieldQuestion = /* @__PURE__ */ remixIcon(RiShieldKeyholeLine);
export const Shirt = /* @__PURE__ */ remixIcon(RiTShirtLine);
export const SkipBack = /* @__PURE__ */ remixIcon(RiSkipBackLine);
export const SkipForward = /* @__PURE__ */ remixIcon(RiSkipForwardLine);
export const SlidersHorizontal = /* @__PURE__ */ remixIcon(RiEqualizerLine);
export const Smile = /* @__PURE__ */ remixIcon(RiEmotionHappyLine);
export const Snap = /* @__PURE__ */ remixIcon(RiFocus2Line);
export const Sparkles = /* @__PURE__ */ remixIcon(RiSparklingLine);
export const Square = /* @__PURE__ */ remixIcon(RiStopLine);
export const SquareStack = /* @__PURE__ */ remixIcon(RiStackLine);
export const Trash2 = /* @__PURE__ */ remixIcon(RiDeleteBinLine);
export const TriangleAlert = /* @__PURE__ */ remixIcon(RiAlertLine);
export const Type = /* @__PURE__ */ remixIcon(RiText);
export const Undo2 = /* @__PURE__ */ remixIcon(RiArrowGoBackLine);
export const Upload = /* @__PURE__ */ remixIcon(RiUploadLine);
export const Users = /* @__PURE__ */ remixIcon(RiGroupLine);
export const Video = /* @__PURE__ */ remixIcon(RiVideoLine);
export const Volume2 = /* @__PURE__ */ remixIcon(RiVolumeUpLine);
export const VolumeX = /* @__PURE__ */ remixIcon(RiVolumeMuteLine);
export const Wrench = /* @__PURE__ */ remixIcon(RiToolsLine);
export const X = /* @__PURE__ */ remixIcon(RiCloseLine);
export const XIcon = /* @__PURE__ */ remixIcon(RiCloseLine);
export const ZoomIn = /* @__PURE__ */ remixIcon(RiZoomInLine);
export const ZoomOut = /* @__PURE__ */ remixIcon(RiZoomOutLine);
