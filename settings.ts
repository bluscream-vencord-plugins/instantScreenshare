import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import type { VoiceMode } from "@vencord/discord-types";

// These components are imported from utils.tsx to keep settings.ts clean
// but still provide the custom UI for selecting media sources and cameras.
import {
    SettingSection,
    FallbackSettingSection,
    CameraSettingSection,
    CameraFallbackSettingSection
} from "./utils";

export const settings = definePluginSettings({
    includeVideoDevices: {
        type: OptionType.BOOLEAN,
        description: "Include video input devices (cameras, capture cards) in the source list",
        default: false,
        restartNeeded: false,
    },
    streamMedia: {
        type: OptionType.COMPONENT,
        component: SettingSection,
    },
    streamMediaFallback: {
        type: OptionType.COMPONENT,
        component: FallbackSettingSection,
    },
    cameraDevice: {
        type: OptionType.COMPONENT,
        component: CameraSettingSection,
    },
    cameraDeviceFallback: {
        type: OptionType.COMPONENT,
        component: CameraFallbackSettingSection,
    },
    autoMuteDeafen: {
        type: OptionType.SELECT,
        description: "Automatically mute or deafen when joining a voice channel",
        options: [
            { label: "Do nothing", value: "none", default: true },
            { label: "Just Mute", value: "mute" },
            { label: "Mute & Deafen", value: "deafen" },
        ],
        restartNeeded: false,
    },
    autoMute: {
        type: OptionType.BOOLEAN,
        description: "Automatically mute/deafen when joining a voice channel (controlled by Auto Mute setting)",
        default: false,
        hidden: true,
        restartNeeded: false,
    },
    autoMicMode: {
        type: OptionType.SELECT,
        description: "Automatically set microphone input mode when joining a voice channel",
        options: [
            { label: "Do nothing", value: "none", default: true },
            { label: "Voice Activity", value: "VOICE_ACTIVITY" as VoiceMode },
            { label: "Push-To-Talk", value: "PUSH_TO_TALK" as VoiceMode },
        ],
        restartNeeded: false,
    },
    autoMicModeToggle: {
        type: OptionType.BOOLEAN,
        description: "Automatically set microphone input mode when joining a voice channel (controlled by Auto Mic Mode setting)",
        default: false,
        hidden: true,
        restartNeeded: false,
    },
    autoStream: {
        type: OptionType.BOOLEAN,
        description: "Automatically start streaming when joining a voice channel",
        default: true,
        hidden: true,
        restartNeeded: false,
    },
    autoCamera: {
        type: OptionType.BOOLEAN,
        description: "Automatically enable camera when joining a voice channel",
        default: false,
        hidden: true,
        restartNeeded: false,
    }
});
