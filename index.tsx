// Authors: Bluscream, Cursor.AI
// Created at 2025-11-13 18:12:29
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { findByCodeLazy, findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, MediaEngineStore, Menu, PermissionsBits, PermissionStore, SelectedChannelStore, showToast, Toasts, UserStore, VoiceActions } from "@webpack/common";

import { getCurrentCamera, getCurrentMedia, settings } from "./utils";

let hasStreamed;
const startStream = findByCodeLazy('type:"STREAM_START"');
const StreamPreviewSettings = getUserSettingLazy("voiceAndVideo", "disableStreamPreviews")!;
const ApplicationStreamingSettingsStore = findStoreLazy("ApplicationStreamingSettingsStore");
const { isVideoEnabled } = findByPropsLazy("isVideoEnabled");

async function autoStartStream() {
    const selected = SelectedChannelStore.getVoiceChannelId();
    if (!selected) return;

    const channel = ChannelStore.getChannel(selected);
    const isGuildChannel = !channel.isDM() && !channel.isGroupDM();

    if (channel.type === 13 || isGuildChannel && !PermissionStore.can(PermissionsBits.STREAM, channel)) return;

    // Auto mute/deafen if enabled
    if (settings.store.autoMute && settings.store.autoMuteDeafen !== "none") {
        if (settings.store.autoMuteDeafen === "deafen" && !MediaEngineStore.isSelfDeaf()) {
            VoiceActions.toggleSelfDeaf();
        } else if (settings.store.autoMuteDeafen === "mute" && !MediaEngineStore.isSelfMute()) {
            VoiceActions.toggleSelfMute();
        }
    }

    // Set microphone input mode if configured and enabled
    if (settings.store.autoMicModeToggle && settings.store.autoMicMode !== "none") {
        const currentState = (MediaEngineStore as any).getState?.() || {};
        const currentMode = currentState.settingsByContext?.default?.mode;
        const targetMode = settings.store.autoMicMode; // Already "PUSH_TO_TALK" or "VOICE_ACTIVITY"
        
        // Only change if different
        if (currentMode !== targetMode) {
            FluxDispatcher.dispatch({
                type: "AUDIO_SET_MODE",
                context: "default",
                mode: targetMode,
                options: currentState.settingsByContext?.default?.modeOptions || {}
            });
        }
    }

    // Enable camera and set device if configured and autoCamera is enabled
    if (settings.store.autoCamera) {
        const camera = getCurrentCamera();
        if (camera) {
            if (!isVideoEnabled()) {
                FluxDispatcher.dispatch({
                    type: "MEDIA_ENGINE_SET_VIDEO_ENABLED",
                    enabled: true,
                });
            }
            // Set the specific camera device
            FluxDispatcher.dispatch({
                type: "MEDIA_ENGINE_SET_VIDEO_DEVICE",
                id: camera.id,
            });
        }
    }

    // Start streaming if autoStream is enabled
    if (settings.store.autoStream) {
        const streamMedia = await getCurrentMedia();
        const preview = StreamPreviewSettings.getSetting();
        const { soundshareEnabled } = ApplicationStreamingSettingsStore.getState();
        let sourceId = streamMedia.id;
        if (streamMedia.type === "video_device") sourceId = `camera:${streamMedia.id}`;

        startStream(channel.guild_id ?? null, selected, {
            "pid": null,
            "sourceId": sourceId,
            "sourceName": streamMedia.name,
            "audioSourceId": streamMedia.name,
            "sound": soundshareEnabled,
            "previewDisabled": preview
        });
    }
}

export default definePlugin({
    name: "InstantScreensharePlus",
    description: "Instantly screenshare when joining a voice channel with support for desktop sources, windows, and video input devices (cameras, capture cards)",
    authors: [Devs.HAHALOSAH, Devs.thororen, EquicordDevs.mart,
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Cursor.AI", id: 0n },],
    dependencies: ["EquicordToolbox"],
    getCurrentMedia,
    settings,

    settingsAboutComponent: () => (
        <>
            <HeadingSecondary>For Linux</HeadingSecondary>
            <Paragraph>
                For Wayland it only pops up the screenshare select
                <br />
                For X11 it may or may not work :shrug:
            </Paragraph>
            <br />
            <HeadingSecondary>Video Devices</HeadingSecondary>
            <Paragraph>
                Supports cameras and capture cards (like Elgato HD60X) when enabled in settings
            </Paragraph>
            <br />
            <HeadingSecondary>Regarding Sound & Preview Settings</HeadingSecondary>
            <Paragraph>
                We use the settings set and used by discord to decide if stream preview and sound should be enabled or not
            </Paragraph>
        </>
    ),

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            // Check if any auto-action is enabled
            const hasAnyAction = settings.store.autoStream || 
                                 settings.store.autoCamera || 
                                 (settings.store.autoMute && settings.store.autoMuteDeafen !== "none") || 
                                 (settings.store.autoMicModeToggle && settings.store.autoMicMode !== "none");
            if (!hasAnyAction) return;
            const myId = UserStore.getCurrentUser().id;
            for (const state of voiceStates) {
                const { userId, channelId } = state;
                if (userId !== myId) continue;

                if (channelId && !hasStreamed) {
                    hasStreamed = true;
                    await autoStartStream();
                }

                if (!channelId) {
                    hasStreamed = false;
                }

                break;
            }
        }
    },

    toolboxActions: {
        "Auto Stream"() {
            settings.store.autoStream = !settings.store.autoStream;
            showToast(`Auto Stream ${settings.store.autoStream ? "Enabled" : "Disabled"}`, Toasts.Type.SUCCESS);
        },
        "Auto Camera"() {
            settings.store.autoCamera = !settings.store.autoCamera;
            showToast(`Auto Camera ${settings.store.autoCamera ? "Enabled" : "Disabled"}`, Toasts.Type.SUCCESS);
        },
        "Auto Mute"() {
            settings.store.autoMute = !settings.store.autoMute;
            showToast(`Auto Mute ${settings.store.autoMute ? "Enabled" : "Disabled"}`, Toasts.Type.SUCCESS);
        },
        "Auto Mic Mode"() {
            settings.store.autoMicModeToggle = !settings.store.autoMicModeToggle;
            showToast(`Auto Mic Mode ${settings.store.autoMicModeToggle ? "Enabled" : "Disabled"}`, Toasts.Type.SUCCESS);
        }
    }
});
