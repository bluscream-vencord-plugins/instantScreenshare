// Authors: Bluscream, Cursor.AI
// Created at 2025-11-13 18:12:46
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import { OptionType } from "@utils/types";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { MediaEngineStore, SearchableSelect, useEffect, useState } from "@webpack/common";

interface PickerProps {
    streamMediaSelection: any[];
    streamMedia: any;
    settingKey: "streamMedia" | "streamMediaFallback";
}

const getDesktopSources = findByCodeLazy("desktop sources");
const configModule = findByPropsLazy("getOutputVolume");
const log = new Logger("InstantScreensharePlus");

export const settings = definePluginSettings({
    includeVideoDevices: {
        type: OptionType.BOOLEAN,
        description: "Include video input devices (cameras, capture cards) in the source list",
        default: false,
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
    },
    autoMute: {
        type: OptionType.BOOLEAN,
        description: "Automatically mute/deafen when joining a voice channel (controlled by Auto Mute setting)",
        default: false,
        hidden: true,
    },
    autoMicMode: {
        type: OptionType.SELECT,
        description: "Automatically set microphone input mode when joining a voice channel",
        options: [
            { label: "Do nothing", value: "none", default: true },
            { label: "Voice Activity", value: "VOICE_ACTIVITY" },
            { label: "Push-To-Talk", value: "PUSH_TO_TALK" },
        ],
    },
    autoMicModeToggle: {
        type: OptionType.BOOLEAN,
        description: "Automatically set microphone input mode when joining a voice channel (controlled by Auto Mic Mode setting)",
        default: false,
        hidden: true,
    },
    autoStream: {
        type: OptionType.BOOLEAN,
        description: "Automatically start streaming when joining a voice channel",
        default: true,
        hidden: true,
    },
    autoCamera: {
        type: OptionType.BOOLEAN,
        description: "Automatically enable camera when joining a voice channel",
        default: false,
        hidden: true,
    }
});

export async function getCurrentMedia() {
    const media = MediaEngineStore.getMediaEngine();
    const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

    if (settings.store.includeVideoDevices) {
        try {
            const videoDevices = Object.values(configModule.getVideoDevices() || {});
            const videoSources = videoDevices.map((device: any) => ({
                id: device.id,
                name: device.name,
                type: "video_device"
            }));
            sources.push(...videoSources);
        } catch (e) {
            log.warn("Failed to get video devices:", e);
        }
    }

    // Try primary source if it's set and not "None"
    if (settings.store.streamMedia && settings.store.streamMedia !== "") {
        const streamMedia = sources.find(screen => screen.id === settings.store.streamMedia);
        if (streamMedia) return streamMedia;
        log.error(`Stream Media "${settings.store.streamMedia}" not found.`);
    }

    // Try to use the fallback source if configured and not "None"
    if (settings.store.streamMediaFallback && settings.store.streamMediaFallback !== "") {
        const fallbackMedia = sources.find(screen => screen.id === settings.store.streamMediaFallback);
        if (fallbackMedia) {
            log.info("Falling back to configured fallback source.");
            return fallbackMedia;
        }
        log.warn(`Fallback Stream Media "${settings.store.streamMediaFallback}" not found.`);
    }

    // Fallback to first available source
    log.info("Resetting to first available source.");
    if (sources.length > 0) {
        settings.store.streamMedia = sources[0].id;
        return sources[0];
    }
    
    log.error("No sources available!");
    throw new Error("No media sources available");
}

function StreamSimplePicker({ streamMediaSelection, streamMedia, settingKey }: PickerProps) {
    const options = [
        { label: "None", value: "", default: false },
        ...streamMediaSelection.map(screen => ({
            label: screen.name,
            value: screen.id,
            default: false,
        }))
    ];

    return (
        <SearchableSelect
            placeholder="Select a media source to stream "
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === (streamMedia || ""))}
            onChange={v => settings.store[settingKey] = v || ""}
            closeOnSelect
        />
    );
}

function ScreenSetting({ settingKey }: { settingKey: "streamMedia" | "streamMediaFallback" }) {
    const { includeVideoDevices } = settings.use(["includeVideoDevices"]);
    const streamMedia = settings.use([settingKey])[settingKey];
    const media = MediaEngineStore.getMediaEngine();
    const [streamMediaSelection, setStreamMediaSelection] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function fetchMedia() {
            setLoading(true);
            const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

            if (includeVideoDevices) {
                try {
                    const videoDevices = Object.values(configModule.getVideoDevices() || {});
                    const videoSources = videoDevices.map((device: any) => ({
                        id: device.id,
                        name: device.name,
                        type: "video_device"
                    }));
                    sources.push(...videoSources);
                } catch (e) {
                    log.warn("Failed to get video devices:", e);
                }
            }

            if (active) {
                setStreamMediaSelection(sources);
                setLoading(false);
            }
        }
        fetchMedia();
        return () => { active = false; };
    }, [includeVideoDevices]);

    if (loading) return <Paragraph>Loading media sources...</Paragraph>;
    if (!streamMediaSelection.length) return <Paragraph>No Media found.</Paragraph>;

    return <StreamSimplePicker streamMediaSelection={streamMediaSelection} streamMedia={streamMedia} settingKey={settingKey} />;
}

function SettingSection() {
    return (
        <section>
            <Heading>Primary streaming source</Heading>
            <Paragraph>Primary source to use for streaming</Paragraph>
            <ScreenSetting settingKey="streamMedia" />
        </section>
    );
}

function FallbackSettingSection() {
    return (
        <section>
            <Heading>Fallback streaming source</Heading>
            <Paragraph>Used if the primary source is not available</Paragraph>
            <ScreenSetting settingKey="streamMediaFallback" />
        </section>
    );
}

export function getCurrentCamera() {
    try {
        const videoDevices = Object.values(configModule.getVideoDevices() || {});
        if (videoDevices.length === 0) {
            log.warn("No video devices available.");
            return null;
        }

        // Try primary camera if it's set and not "None"
        if (settings.store.cameraDevice && settings.store.cameraDevice !== "") {
            const camera = videoDevices.find((device: any) => device.id === settings.store.cameraDevice);
            if (camera) return camera;
            log.error(`Camera "${settings.store.cameraDevice}" not found.`);
        }

        // Try to use the fallback camera if configured and not "None"
        if (settings.store.cameraDeviceFallback && settings.store.cameraDeviceFallback !== "") {
            const fallbackCamera = videoDevices.find((device: any) => device.id === settings.store.cameraDeviceFallback);
            if (fallbackCamera) {
                log.info("Falling back to configured fallback camera.");
                return fallbackCamera;
            }
            log.warn(`Fallback Camera "${settings.store.cameraDeviceFallback}" not found.`);
        }

        // Only fallback to first available camera if at least one setting is configured (not both "None")
        const hasPrimary = settings.store.cameraDevice && settings.store.cameraDevice !== "";
        const hasFallback = settings.store.cameraDeviceFallback && settings.store.cameraDeviceFallback !== "";
        
        if (!hasPrimary && !hasFallback) {
            // Both are "None" - don't enable camera
            return null;
        }

        // Fallback to first available camera if one of the settings was configured but device not found
        if (videoDevices.length > 0) {
            log.info("Using first available camera.");
            return videoDevices[0] as any;
        }

        return null;
    } catch (e) {
        log.warn("Failed to get video devices:", e);
        return null;
    }
}

interface CameraPickerProps {
    cameraSelection: any[];
    camera: any;
    settingKey: "cameraDevice" | "cameraDeviceFallback";
}

function CameraSimplePicker({ cameraSelection, camera, settingKey }: CameraPickerProps) {
    const options = [
        { label: "None", value: "", default: false },
        ...cameraSelection.map((device: any) => ({
            label: device.name,
            value: device.id,
            default: false,
        }))
    ];

    return (
        <SearchableSelect
            placeholder="Select a camera device"
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === (camera || ""))}
            onChange={v => settings.store[settingKey] = v || ""}
            closeOnSelect
        />
    );
}

function CameraSetting({ settingKey }: { settingKey: "cameraDevice" | "cameraDeviceFallback" }) {
    const camera = settings.use([settingKey])[settingKey];
    const [cameraSelection, setCameraSelection] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        function fetchCameras() {
            setLoading(true);
            try {
                const videoDevices = Object.values(configModule.getVideoDevices() || {});
                if (active) {
                    setCameraSelection(videoDevices);
                    setLoading(false);
                }
            } catch (e) {
                log.warn("Failed to get video devices:", e);
                if (active) {
                    setCameraSelection([]);
                    setLoading(false);
                }
            }
        }
        fetchCameras();
        return () => { active = false; };
    }, []);

    if (loading) return <Paragraph>Loading camera devices...</Paragraph>;
    if (!cameraSelection.length) return <Paragraph>No cameras found.</Paragraph>;

    return <CameraSimplePicker cameraSelection={cameraSelection} camera={camera} settingKey={settingKey} />;
}

function CameraSettingSection() {
    return (
        <section>
            <Heading>Primary camera device</Heading>
            <Paragraph>Primary camera to use when joining a voice channel</Paragraph>
            <CameraSetting settingKey="cameraDevice" />
        </section>
    );
}

function CameraFallbackSettingSection() {
    return (
        <section>
            <Heading>Fallback camera device</Heading>
            <Paragraph>Used if the primary camera is not available</Paragraph>
            <CameraSetting settingKey="cameraDeviceFallback" />
        </section>
    );
}
