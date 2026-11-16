(() => {
    const DOMElements = {
        canvasPreview: document.querySelector('.element_canvas_preview'),
        textHeaderInput: document.querySelector('.element_input_text_header'),
        textTitleInput: document.querySelector('.element_input_text_title'),
        textContentInput: document.querySelector('.element_input_text_content'),
        textSubtitleInput: document.querySelector('.element_input_text_subtitle'),
        textFooterInput: document.querySelector('.element_input_text_footer'),
        textRibbonTitleInput: document.querySelector('.element_input_text_ribbon_title'),
        textRibbonContentInput: document.querySelector('.element_input_text_ribbon_content'),
        fontFamilyInput: document.querySelector('.element_input_font_family'),
        backgroundInput: document.querySelector('.element_input_background'),
        removeBackgroundButton: document.querySelector('.element_button_remove_background'),
        backgroundOpacityInput: document.querySelector('.element_input_background_opacity'),
        backgroundOpacityOutput: document.querySelector('.element_input_background_opacity_value'),
        backgroundAlignInput: document.querySelector('.element_input_background_align'),
        backgroundColorInput: document.querySelector('.element_input_bg_color'),
        keyColorInput: document.querySelector('.element_input_key_color'),
        textColorInput: document.querySelector('.element_input_text_color'),
        matchImageColorInput: document.querySelector('.element_input_match_image_color'),
        downloadButton: document.querySelector('.element_button_download'),
        resetButton: document.querySelector('.element_button_reset')
    };

    const canvasContext = DOMElements.canvasPreview.getContext('2d');

    const CANVAS_CONFIG = {
        width: 1920,
        height: 1080,
        centerX: 960,
        centerY: 540,
        maxTextWidth: 1500,
        lineHeightMultiplier: 0.95,
        fontWeightBold: 900,
        headerPositionY: 143,
        headerFontSize: 54,
        footerPositionY: 947,
        footerFontSize: 46,
        titleFontSize: 64,
        contentFontSize: 158,
        subtitleFontSize: 64,
        contentGroupGap: 24,
        shrinkTriggerLineCount: 2,
        shrinkMaxContainerHeight: 470,
        shrinkMinimumFontSize: 48,
        shrinkStepSize: 2,
        colorExtraction: {
            sampleDimension: 80,
            minimumAlpha: 128,
            minimumBrightnessThreshold: 35,
            maximumBrightnessThreshold: 245,
            minimumSaturationThreshold: 0.25,
            minimumReadableLightness: 0.58,
            maximumReadableLightness: 0.78
        },
        ribbon: {
            titleFontSize: 38,
            contentFontSize: 58,
            horizontalPadding: 35,
            verticalPadding: 22,
            innerLineGap: 8,
            minimumBoxWidth: 460,
            anchorX: 1808,
            anchorY: 106,
            rotationAngle: Math.PI / 4,
            backgroundColor: '#e00000',
            staticTitleColor: '#ffde59',
            staticContentColor: '#ffffff'
        },
        fallbackExportFileName: 'thumbnail.png'
    };

    const defaultStyleConfiguration = {
        fontFamilyInput: 'Bernoru Black Medium',
        backgroundOpacityInput: '25',
        backgroundAlignInput: 'center',
        backgroundColorInput: '#000000',
        keyColorInput: '#ffde59',
        textColorInput: '#ffffff'
    };

    const realtimeInputElements = [
        DOMElements.textHeaderInput,
        DOMElements.textTitleInput,
        DOMElements.textContentInput,
        DOMElements.textSubtitleInput,
        DOMElements.textFooterInput,
        DOMElements.textRibbonTitleInput,
        DOMElements.textRibbonContentInput,
        DOMElements.fontFamilyInput,
        DOMElements.backgroundOpacityInput,
        DOMElements.backgroundAlignInput,
        DOMElements.backgroundColorInput,
        DOMElements.keyColorInput,
        DOMElements.textColorInput
    ];

    let imageBackground = null;
    let imageObjectUrl = null;
    let cachedExtractedHexColor = null;
    let previousManualKeyColor = defaultStyleConfiguration.keyColorInput;

    const getSanitizedFontFamily = () => {
        const rawFontFamily = DOMElements.fontFamilyInput.value.trim() || 'Arial';
        return rawFontFamily.replace(/["']/g, '');
    };

    const buildFontStyle = (fontWeight, fontSize) => {
        return `${fontWeight} ${fontSize}px "${getSanitizedFontFamily()}", Arial, sans-serif`;
    };

    const sanitizeFileNamePart = (rawText) => {
        return String(rawText || '')
            .replace(/\s+/g, ' ')
            .replace(/[\\/:*?"<>|]/g, '')
            .trim();
    };

    const generateExportFileName = () => {
        const sanitizedTitle = sanitizeFileNamePart(DOMElements.textTitleInput.value);
        const sanitizedContent = sanitizeFileNamePart(DOMElements.textContentInput.value);
        const fileNameParts = [sanitizedTitle, sanitizedContent].filter(Boolean);

        return fileNameParts.length ? `${fileNameParts.join(' - ')}.png` : CANVAS_CONFIG.fallbackExportFileName;
    };

    const convertComponentToHex = (colorValue) => {
        const clampedValue = Math.max(0, Math.min(255, Math.round(colorValue)));
        return clampedValue.toString(16).padStart(2, '0');
    };

    const convertRgbToHsl = (red, green, blue) => {
        const normalizedRed = red / 255;
        const normalizedGreen = green / 255;
        const normalizedBlue = blue / 255;

        const maxChannel = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
        const minChannel = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
        const lightness = (maxChannel + minChannel) / 2;

        if (maxChannel === minChannel) {
            return { hue: 0, saturation: 0, lightness };
        }

        const channelDelta = maxChannel - minChannel;
        const saturation = lightness > 0.5
            ? channelDelta / (2 - maxChannel - minChannel)
            : channelDelta / (maxChannel + minChannel);

        let hue = 0;
        if (maxChannel === normalizedRed) {
            hue = (normalizedGreen - normalizedBlue) / channelDelta + (normalizedGreen < normalizedBlue ? 6 : 0);
        } else if (maxChannel === normalizedGreen) {
            hue = (normalizedBlue - normalizedRed) / channelDelta + 2;
        } else {
            hue = (normalizedRed - normalizedGreen) / channelDelta + 4;
        }
        hue /= 6;

        return { hue, saturation, lightness };
    };

    const convertHueToRgbChannel = (primaryBound, secondaryBound, adjustedHue) => {
        let wrappedHue = adjustedHue;
        if (wrappedHue < 0) wrappedHue += 1;
        if (wrappedHue > 1) wrappedHue -= 1;
        if (wrappedHue < 1 / 6) return primaryBound + (secondaryBound - primaryBound) * 6 * wrappedHue;
        if (wrappedHue < 1 / 2) return secondaryBound;
        if (wrappedHue < 2 / 3) return primaryBound + (secondaryBound - primaryBound) * (2 / 3 - wrappedHue) * 6;
        return primaryBound;
    };

    const convertHslToHex = (hue, saturation, lightness) => {
        if (saturation === 0) {
            const grayChannel = lightness * 255;
            const hexGray = convertComponentToHex(grayChannel);
            return `#${hexGray}${hexGray}${hexGray}`;
        }

        const secondaryBound = lightness < 0.5
            ? lightness * (1 + saturation)
            : lightness + saturation - lightness * saturation;
        const primaryBound = 2 * lightness - secondaryBound;

        const redChannel = convertHueToRgbChannel(primaryBound, secondaryBound, hue + 1 / 3) * 255;
        const greenChannel = convertHueToRgbChannel(primaryBound, secondaryBound, hue) * 255;
        const blueChannel = convertHueToRgbChannel(primaryBound, secondaryBound, hue - 1 / 3) * 255;

        return `#${convertComponentToHex(redChannel)}${convertComponentToHex(greenChannel)}${convertComponentToHex(blueChannel)}`;
    };

    const extractDominantVibrantHexColorFromImage = (imageElement) => {
        const {
            sampleDimension,
            minimumAlpha,
            minimumBrightnessThreshold,
            maximumBrightnessThreshold,
            minimumSaturationThreshold,
            minimumReadableLightness,
            maximumReadableLightness
        } = CANVAS_CONFIG.colorExtraction;

        const sampleCanvas = document.createElement('canvas');
        const sampleContext = sampleCanvas.getContext('2d');

        sampleCanvas.width = sampleDimension;
        sampleCanvas.height = sampleDimension;
        sampleContext.drawImage(imageElement, 0, 0, sampleDimension, sampleDimension);

        const pixelData = sampleContext.getImageData(0, 0, sampleDimension, sampleDimension).data;
        const hueBuckets = new Map();

        let fallbackWeightedRed = 0;
        let fallbackWeightedGreen = 0;
        let fallbackWeightedBlue = 0;
        let fallbackTotalWeight = 0;

        const pixelIndices = Array.from({ length: pixelData.length / 4 }, (_, index) => index * 4);
        pixelIndices.forEach((pixelIndex) => {
            const alphaChannel = pixelData[pixelIndex + 3];
            if (alphaChannel < minimumAlpha) return;

            const red = pixelData[pixelIndex];
            const green = pixelData[pixelIndex + 1];
            const blue = pixelData[pixelIndex + 2];

            const perceivedBrightness = (red * 299 + green * 587 + blue * 114) / 1000;
            if (perceivedBrightness < minimumBrightnessThreshold || perceivedBrightness > maximumBrightnessThreshold) {
                return;
            }

            const { hue, saturation, lightness } = convertRgbToHsl(red, green, blue);

            const generalWeight = 0.2 + saturation;
            fallbackWeightedRed += red * generalWeight;
            fallbackWeightedGreen += green * generalWeight;
            fallbackWeightedBlue += blue * generalWeight;
            fallbackTotalWeight += generalWeight;

            if (saturation >= minimumSaturationThreshold) {
                const bucketKey = Math.floor(hue * 36) % 36;
                const vibrancyWeight = Math.pow(saturation, 2) * (1 - Math.abs(lightness - 0.5));

                const currentBucket = hueBuckets.get(bucketKey) || {
                    totalWeight: 0,
                    weightedRed: 0,
                    weightedGreen: 0,
                    weightedBlue: 0
                };

                currentBucket.totalWeight += vibrancyWeight;
                currentBucket.weightedRed += red * vibrancyWeight;
                currentBucket.weightedGreen += green * vibrancyWeight;
                currentBucket.weightedBlue += blue * vibrancyWeight;

                hueBuckets.set(bucketKey, currentBucket);
            }
        });

        let selectedRed = 0;
        let selectedGreen = 0;
        let selectedBlue = 0;

        if (hueBuckets.size > 0) {
            let dominantBucket = null;
            hueBuckets.forEach((bucket) => {
                if (!dominantBucket || bucket.totalWeight > dominantBucket.totalWeight) {
                    dominantBucket = bucket;
                }
            });

            selectedRed = dominantBucket.weightedRed / dominantBucket.totalWeight;
            selectedGreen = dominantBucket.weightedGreen / dominantBucket.totalWeight;
            selectedBlue = dominantBucket.weightedBlue / dominantBucket.totalWeight;
        } else if (fallbackTotalWeight > 0) {
            selectedRed = fallbackWeightedRed / fallbackTotalWeight;
            selectedGreen = fallbackWeightedGreen / fallbackTotalWeight;
            selectedBlue = fallbackWeightedBlue / fallbackTotalWeight;
        } else {
            return defaultStyleConfiguration.keyColorInput;
        }

        const finalHsl = convertRgbToHsl(selectedRed, selectedGreen, selectedBlue);
        const adjustedLightness = Math.max(
            minimumReadableLightness,
            Math.min(maximumReadableLightness, finalHsl.lightness)
        );
        const adjustedSaturation = finalHsl.saturation > 0.1
            ? Math.max(finalHsl.saturation, 0.65)
            : finalHsl.saturation;

        return convertHslToHex(finalHsl.hue, adjustedSaturation, adjustedLightness);
    };

    const synchronizeKeyColorWithToggle = () => {
        if (!DOMElements.matchImageColorInput) return;

        const isMatchEnabled = DOMElements.matchImageColorInput.checked;
        if (isMatchEnabled && imageBackground && cachedExtractedHexColor) {
            DOMElements.keyColorInput.value = cachedExtractedHexColor;
        } else {
            DOMElements.keyColorInput.value = previousManualKeyColor;
        }
    };

    const applyCanvasTextAlignment = (horizontalAlign = 'center', verticalBaseline = 'middle') => {
        canvasContext.textAlign = horizontalAlign;
        canvasContext.textBaseline = verticalBaseline;
    };

    const clearBackgroundImageState = () => {
        imageBackground = null;
        cachedExtractedHexColor = null;
        if (imageObjectUrl) {
            URL.revokeObjectURL(imageObjectUrl);
            imageObjectUrl = null;
        }
        DOMElements.backgroundInput.value = '';
        DOMElements.removeBackgroundButton.classList.add('hidden');
        synchronizeKeyColorWithToggle();
    };

    const calculateAlignedVerticalOffset = (scaledHeight, alignmentMode) => {
        const verticalDifference = CANVAS_CONFIG.height - scaledHeight;
        if (alignmentMode === 'top') return 0;
        if (alignmentMode === 'bottom') return verticalDifference;
        return verticalDifference / 2;
    };

    const drawBackgroundLayer = () => {
        canvasContext.fillStyle = DOMElements.backgroundColorInput.value || defaultStyleConfiguration.backgroundColorInput;
        canvasContext.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);

        if (!imageBackground) return;

        const scaleRatio = Math.max(
            CANVAS_CONFIG.width / imageBackground.width,
            CANVAS_CONFIG.height / imageBackground.height
        );
        const scaledWidth = imageBackground.width * scaleRatio;
        const scaledHeight = imageBackground.height * scaleRatio;
        const offsetX = (CANVAS_CONFIG.width - scaledWidth) / 2;
        const alignmentMode = DOMElements.backgroundAlignInput ? DOMElements.backgroundAlignInput.value : 'center';
        const offsetY = calculateAlignedVerticalOffset(scaledHeight, alignmentMode);

        canvasContext.save();
        canvasContext.globalAlpha = Number(DOMElements.backgroundOpacityInput.value) / 100;
        canvasContext.drawImage(imageBackground, offsetX, offsetY, scaledWidth, scaledHeight);
        canvasContext.restore();
    };

    const wrapParagraphLines = (rawText, maximumWidth, fontStyle) => {
        canvasContext.font = fontStyle;
        const paragraphs = String(rawText || '').split(/\r?\n/);
        const wrappedLines = [];

        paragraphs.forEach((paragraph) => {
            if (!paragraph.trim()) {
                wrappedLines.push('');
                return;
            }

            const words = paragraph.split(/\s+/);
            let currentLine = '';

            words.forEach((word) => {
                const candidateLine = currentLine ? `${currentLine} ${word}` : word;
                if (currentLine && canvasContext.measureText(candidateLine).width > maximumWidth) {
                    wrappedLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = candidateLine;
                }
            });

            wrappedLines.push(currentLine);
        });

        return wrappedLines;
    };

    const calculateTextLayoutMetrics = (rawText, initialFontSize, fontWeight, maximumWidth, lineSpacing = 0, shouldShrink = false) => {
        let activeFontSize = initialFontSize;
        let wrappedLines = wrapParagraphLines(rawText, maximumWidth, buildFontStyle(fontWeight, activeFontSize));

        if (shouldShrink && wrappedLines.length > CANVAS_CONFIG.shrinkTriggerLineCount) {
            while (
                wrappedLines.length * activeFontSize * CANVAS_CONFIG.lineHeightMultiplier > CANVAS_CONFIG.shrinkMaxContainerHeight &&
                activeFontSize > CANVAS_CONFIG.shrinkMinimumFontSize
            ) {
                activeFontSize -= CANVAS_CONFIG.shrinkStepSize;
                wrappedLines = wrapParagraphLines(rawText, maximumWidth, buildFontStyle(fontWeight, activeFontSize));
            }
        }

        const singleLineHeight = activeFontSize * CANVAS_CONFIG.lineHeightMultiplier + lineSpacing;
        const totalBlockHeight = wrappedLines.length * singleLineHeight - lineSpacing;

        return {
            wrappedLines,
            activeFontSize,
            singleLineHeight,
            totalBlockHeight
        };
    };

    const renderCalculatedTextLines = (textMetrics, centerPositionY, fillColor, fontWeight, maximumWidth) => {
        const { wrappedLines, activeFontSize, singleLineHeight, totalBlockHeight } = textMetrics;
        if (!wrappedLines.length) return;

        let currentPositionY = centerPositionY - totalBlockHeight / 2 + activeFontSize / 2;

        canvasContext.save();
        canvasContext.font = buildFontStyle(fontWeight, activeFontSize);
        applyCanvasTextAlignment();
        canvasContext.fillStyle = fillColor;

        wrappedLines.forEach((lineText) => {
            if (lineText) {
                canvasContext.fillText(lineText, CANVAS_CONFIG.centerX, currentPositionY, maximumWidth);
            }
            currentPositionY += singleLineHeight;
        });

        canvasContext.restore();
    };

    const drawHeaderSection = (selectedKeyColor, selectedTextColor) => {
        const headerText = DOMElements.textHeaderInput.value;
        if (!headerText.trim()) return;

        canvasContext.save();
        canvasContext.font = buildFontStyle(CANVAS_CONFIG.fontWeightBold, CANVAS_CONFIG.headerFontSize);
        applyCanvasTextAlignment();

        if (headerText === 'SyncMusics') {
            const brandParts = [
                { text: 'Sync', color: selectedKeyColor },
                { text: 'Musics', color: selectedTextColor }
            ];

            let totalBrandWidth = 0;
            brandParts.forEach((part) => {
                part.width = canvasContext.measureText(part.text).width;
                totalBrandWidth += part.width;
            });

            let currentBrandX = (CANVAS_CONFIG.width - totalBrandWidth) / 2;
            applyCanvasTextAlignment('left', 'middle');

            brandParts.forEach((part) => {
                canvasContext.fillStyle = part.color;
                canvasContext.fillText(part.text, currentBrandX, CANVAS_CONFIG.headerPositionY);
                currentBrandX += part.width;
            });
        } else {
            canvasContext.fillStyle = selectedKeyColor;
            canvasContext.fillText(headerText, CANVAS_CONFIG.centerX, CANVAS_CONFIG.headerPositionY, CANVAS_CONFIG.maxTextWidth);
        }

        canvasContext.restore();
    };

    const drawCenterContentGroup = (selectedKeyColor, selectedTextColor) => {
        const contentSectionDefinitions = [
            {
                rawText: DOMElements.textTitleInput.value,
                fontSize: CANVAS_CONFIG.titleFontSize,
                fillColor: selectedKeyColor,
                bottomGap: CANVAS_CONFIG.contentGroupGap,
                shouldShrink: false
            },
            {
                rawText: DOMElements.textContentInput.value,
                fontSize: CANVAS_CONFIG.contentFontSize,
                fillColor: selectedTextColor,
                bottomGap: CANVAS_CONFIG.contentGroupGap,
                shouldShrink: true
            },
            {
                rawText: DOMElements.textSubtitleInput.value,
                fontSize: CANVAS_CONFIG.subtitleFontSize,
                fillColor: selectedTextColor,
                bottomGap: 0,
                shouldShrink: false
            }
        ];

        const activeContentBlocks = [];
        contentSectionDefinitions.forEach((definition) => {
            if (!definition.rawText.trim()) return;

            const layoutMetrics = calculateTextLayoutMetrics(
                definition.rawText,
                definition.fontSize,
                CANVAS_CONFIG.fontWeightBold,
                CANVAS_CONFIG.maxTextWidth,
                0,
                definition.shouldShrink
            );

            activeContentBlocks.push({
                ...definition,
                layoutMetrics
            });
        });

        let totalGroupHeight = 0;
        activeContentBlocks.forEach((block, index) => {
            totalGroupHeight += block.layoutMetrics.totalBlockHeight;
            if (index < activeContentBlocks.length - 1) {
                totalGroupHeight += block.bottomGap;
            }
        });

        let currentVerticalOffset = CANVAS_CONFIG.centerY - totalGroupHeight / 2;
        activeContentBlocks.forEach((block) => {
            const blockCenterY = currentVerticalOffset + block.layoutMetrics.totalBlockHeight / 2;
            renderCalculatedTextLines(
                block.layoutMetrics,
                blockCenterY,
                block.fillColor,
                CANVAS_CONFIG.fontWeightBold,
                CANVAS_CONFIG.maxTextWidth
            );
            currentVerticalOffset += block.layoutMetrics.totalBlockHeight + block.bottomGap;
        });
    };

    const drawCornerRibbon = () => {
        const ribbonTitleText = DOMElements.textRibbonTitleInput.value.trim();
        const ribbonContentText = DOMElements.textRibbonContentInput.value.trim();
        if (!ribbonTitleText && !ribbonContentText) return;

        const {
            titleFontSize,
            contentFontSize,
            horizontalPadding,
            verticalPadding,
            innerLineGap,
            minimumBoxWidth,
            anchorX,
            anchorY,
            rotationAngle,
            backgroundColor,
            staticTitleColor,
            staticContentColor
        } = CANVAS_CONFIG.ribbon;

        const ribbonRows = [
            {
                text: ribbonTitleText,
                fontSize: titleFontSize,
                color: staticTitleColor,
                offsetY: -(contentFontSize + innerLineGap) / 2
            },
            {
                text: ribbonContentText,
                fontSize: contentFontSize,
                color: staticContentColor,
                offsetY: (titleFontSize + innerLineGap) / 2
            }
        ];

        let widestTextWidth = 0;
        ribbonRows.forEach((row) => {
            canvasContext.font = buildFontStyle(CANVAS_CONFIG.fontWeightBold, row.fontSize);
            const measuredWidth = canvasContext.measureText(row.text).width;
            if (measuredWidth > widestTextWidth) {
                widestTextWidth = measuredWidth;
            }
        });

        const ribbonBoxWidth = Math.max(minimumBoxWidth, widestTextWidth + horizontalPadding * 2);
        const ribbonBoxHeight = titleFontSize + contentFontSize + innerLineGap + verticalPadding * 2;

        canvasContext.save();
        canvasContext.translate(anchorX, anchorY);
        canvasContext.rotate(rotationAngle);

        canvasContext.fillStyle = backgroundColor;
        canvasContext.fillRect(-ribbonBoxWidth / 2, -ribbonBoxHeight / 2, ribbonBoxWidth, ribbonBoxHeight);

        applyCanvasTextAlignment();
        ribbonRows.forEach((row) => {
            canvasContext.font = buildFontStyle(CANVAS_CONFIG.fontWeightBold, row.fontSize);
            canvasContext.fillStyle = row.color;
            canvasContext.fillText(row.text, 0, row.offsetY);
        });

        canvasContext.restore();
    };

    const renderCanvas = () => {
        const selectedKeyColor = DOMElements.keyColorInput.value || defaultStyleConfiguration.keyColorInput;
        const selectedTextColor = DOMElements.textColorInput.value || defaultStyleConfiguration.textColorInput;

        drawBackgroundLayer();
        drawHeaderSection(selectedKeyColor, selectedTextColor);
        drawCenterContentGroup(selectedKeyColor, selectedTextColor);

        const footerText = DOMElements.textFooterInput.value;
        if (footerText.trim()) {
            const footerMetrics = calculateTextLayoutMetrics(
                footerText,
                CANVAS_CONFIG.footerFontSize,
                CANVAS_CONFIG.fontWeightBold,
                CANVAS_CONFIG.maxTextWidth
            );
            renderCalculatedTextLines(
                footerMetrics,
                CANVAS_CONFIG.footerPositionY,
                selectedKeyColor,
                CANVAS_CONFIG.fontWeightBold,
                CANVAS_CONFIG.maxTextWidth
            );
        }

        drawCornerRibbon();
        DOMElements.backgroundOpacityOutput.textContent = `${DOMElements.backgroundOpacityInput.value}%`;
    };

    // Event Listeners
    realtimeInputElements.forEach((element) => {
        if (!element) return;

        const handleInputUpdate = () => {
            if (element === DOMElements.keyColorInput) {
                previousManualKeyColor = DOMElements.keyColorInput.value;
                if (DOMElements.matchImageColorInput && DOMElements.matchImageColorInput.checked) {
                    DOMElements.matchImageColorInput.checked = false;
                }
            }
            renderCanvas();
        };

        element.addEventListener('input', handleInputUpdate);
        element.addEventListener('change', handleInputUpdate);
    });

    if (DOMElements.matchImageColorInput) {
        DOMElements.matchImageColorInput.addEventListener('change', () => {
            synchronizeKeyColorWithToggle();
            renderCanvas();
        });
    }

    DOMElements.backgroundInput.addEventListener('change', (changeEvent) => {
        const selectedFile = changeEvent.target.files && changeEvent.target.files[0];
        if (!selectedFile || !selectedFile.type.startsWith('image/')) return;

        if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
        imageObjectUrl = URL.createObjectURL(selectedFile);

        const loadedImage = new Image();
        loadedImage.onload = () => {
            imageBackground = loadedImage;
            cachedExtractedHexColor = extractDominantVibrantHexColorFromImage(loadedImage);
            DOMElements.removeBackgroundButton.classList.remove('hidden');
            synchronizeKeyColorWithToggle();
            renderCanvas();
        };
        loadedImage.src = imageObjectUrl;
    });

    DOMElements.removeBackgroundButton.addEventListener('click', () => {
        clearBackgroundImageState();
        renderCanvas();
    });

    DOMElements.downloadButton.addEventListener('click', () => {
        if (!DOMElements.textTitleInput.value.trim() || !DOMElements.textContentInput.value.trim()) {
            return;
        }
        const downloadLink = document.createElement('a');
        downloadLink.download = generateExportFileName();
        downloadLink.href = DOMElements.canvasPreview.toDataURL('image/png');
        downloadLink.click();
    });

    DOMElements.resetButton.addEventListener('click', () => {
        Object.entries(defaultStyleConfiguration).forEach(([elementKey, defaultValue]) => {
            if (DOMElements[elementKey]) {
                DOMElements[elementKey].value = defaultValue;
            }
        });

        previousManualKeyColor = defaultStyleConfiguration.keyColorInput;
        if (DOMElements.matchImageColorInput) {
            DOMElements.matchImageColorInput.checked = false;
        }

        clearBackgroundImageState();
        renderCanvas();
    });

    renderCanvas();
})();