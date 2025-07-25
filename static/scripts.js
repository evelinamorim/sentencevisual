const tooltip = d3.select("#tooltip");

function populateFileDropdown() {
    fetch('/get-files')
        .then(response => response.json())
        .then(files => {
            const fileSelect = document.getElementById('fileSelect');

            // Clear existing options (if any)
            fileSelect.innerHTML = '<option value="">Select a file</option>';

            files.sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0], 10);
                const numB = parseInt(b.match(/\d+/)[0], 10);
                return numA - numB;
            });

            // Populate with files from the server
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                fileSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching file list:', error));
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', populateFileDropdown);

let treeData;
function visualizeJSON(fileName) {

    if (!fileName) {
        console.error("No file selected");
        return;
    }


    fetch(`/get-json?file=${fileName}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch JSON data for file: ${fileName}`);
            }
            return response.json();
        })
        .then(data => {

            const wrapper = d3.select("#visualization-wrapper");
            wrapper.selectAll("*").remove();
            renderSentences(data.sentences);

        })
        .catch(error => console.error('Error fetching JSON data:', error));

}

let sharedSVG;
function setupVisualization() {
    const wrapper = d3.select("#visualization-wrapper");
    wrapper
        .style("position", "relative")  // Change from "relative" to "fixed"
        .style("left", "auto")          // Anchor to left edge
        .style("top", "auto")           // Anchor to top (adjust if needed)
        .style("margin", "0")     // Keep your margin
        .style("z-index", "10")   // Ensure it stays above other content
        .style("width", "100%")  // Set explicit width (adjust as needed)
        .style("height", "auto")  // Ensure vertical containment
        .style("display","flex")
        .style("flex-direction","row")
        .style("padding","10px")
        .style("overflow", "visible");  // Make it scrollable


    wrapper.selectAll("svg.arrows").remove();

    wrapper.append("div")
        .attr("class", "sentences-column")
        .style("width", "40%")
        .style("overflow-y", "auto");

    // Create timeline column (right side)
    const timelineColumn = wrapper.append("div")
        .attr("class", "timeline-column")
        .style("width", "60%")
        .style("position", "relative")
        .style("overflow","hidden");

    sharedSVG = timelineColumn.append("svg")
        .attr("class", "arrows")
        .style("position", "absolute")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
        .style("z-index", "3");

    // Add arrow marker definition
    sharedSVG.append("defs")
        .append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", "8")
        .attr("refY", "0")
        .attr("markerWidth", "8")
        .attr("markerHeight", "8")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "black")
        .style("outline", "1px solid red"); ;

}


// Render sentences with events and time expressions
function renderSentences(sentences) {
    setupVisualization();

    const results = sentences.map((sentence, index) => renderSentenceTimeline(sentence, index));

    const allFragments = results.map(r => r.fragments);
    const allLinkedTimes = results.map(r => r.linkedTimes);

    const cleanup = renderTimeline(allFragments, allLinkedTimes);

}

function renderSentenceTimeline(sentence, index) {
    const wrapper = d3.select("#visualization-wrapper");
    const container = d3.select(".sentences-container");

    // Get the sentences column (left)
    const textContainer = d3.select(".sentences-column")
        .append("div")
        .attr("class", "sentence-text")
        .attr("data-sentence-index", index)
        .style("margin-bottom", "10px")
        .style("padding", "15px")
        .style("background", "#f8f8f8");

    // Add sentence text to left column
    //textContainer.text(sentence.text);
    const addedEventIds = new Set();

    const fragments = createFragments(sentence.text, sentence);
    //console.log(sentence.text);
    fragments.forEach(fragment => {

        if (fragment.type === "yellow-box") {

            if (fragment.time.Time_Type == "Duration" ||
                fragment.time.Time_Type == "Set") {
                backColor = "#AF8FBA"; // lilás
            } else {
                backColor = "#4B5F92"; // azul escuro
            }

            textContainer.append("span")
                .style("background-color", backColor) // Yellow highlight
                .style("padding", "2px")
                .style("border-radius", "3px")
                .text(fragment.time.text);

        } else if (fragment.type === "blue-box") {
            if (!addedEventIds.has(fragment.event.id)) {
                addedEventIds.add(fragment.event.id); // Mark as added

                textContainer.append("span")
                    .style("background-color", "#AF8FBA") // Blue highlight
                    .style("padding", "2px")
                    .style("border-radius", "3px")
                    .text(fragment.event.text);
            }
        } else {
            textContainer.append("span")
                .text(fragment.text); // Regular text
        }
    });
    return {
        fragments: fragments,
        linkedTimes: sentence.linked_times
    };
}

function renderTimeline(allFragments, allLinkedTimes) {


    const wrapper = d3.select("#visualization-wrapper");
    const timelineColumn = d3.select(".timeline-column");

    let currentlyHighlightedSentence = null;

    const eventsContainer = timelineColumn.append("div")
        .style("position", "absolute")
        .style("z-index","2")
        .style("left", "0")
        .style("top", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none");

    const tooltip = d3.select("body").append("div")
        .attr("class", "event-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background-color", "white")
        .style("border", "1px solid #ddd")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("box-shadow", "0 2px 5px rgba(0,0,0,0.2)")
        .style("font-size", "14px")
        .style("z-index", "1000");

    const timelineContainer = timelineColumn.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center");


    const timeBoxes = [];

    // Function to find which sentence contains a given time expression
    function findSentenceContainingTime(timeId) {
        let sentenceElement = null;

        allFragments.forEach((fragments, index) => {
            fragments.forEach(fragment => {
                if (fragment.type === "yellow-box" && fragment.time && fragment.time.id === timeId) {
                    sentenceElement = d3.select(`.sentence-text[data-sentence-index="${index}"]`);
                }
            });
        });

        return sentenceElement;
    }

    // Function to toggle sentence highlight
    function toggleSentenceHighlight(timeId) {
        const sentenceToHighlight = findSentenceContainingTime(timeId);

        if (!sentenceToHighlight) return;

        // If there's already a highlighted sentence and it's different from the one being clicked
        if (currentlyHighlightedSentence &&
            currentlyHighlightedSentence.node() !== sentenceToHighlight.node()) {
            // Reset the previous one
            currentlyHighlightedSentence.style("background", "#f8f8f8");
        }

        // Toggle the clicked sentence
        if (currentlyHighlightedSentence &&
            currentlyHighlightedSentence.node() === sentenceToHighlight.node()) {
            // It's already highlighted, so turn it off
            sentenceToHighlight.style("background", "#f8f8f8");
            currentlyHighlightedSentence = null;
        } else {
            // Highlight the new sentence
            sentenceToHighlight.style("background", "#B2FEAB");
            currentlyHighlightedSentence = sentenceToHighlight;
        }
    }

    // Render yellow boxes
    let positionTimeline = 0; // position in the timeline
    allFragments.forEach(fragments => {
        fragments.forEach(fragment => {
            if (fragment.type === "yellow-box") {
                if (fragment.time.Time_Type == "Duration" ||
                    fragment.time.Time_Type == "Set"){
                    backColor = "#ff8800";
                } else {
                    backColor = "#ffff00";
                }

                const timeBox = timelineContainer.append("span")
                    .attr("id", fragment.time.id)
                    .attr("position", positionTimeline)
                    .text(fragment.text)
                    .classed("yellow-box", true)
                    .style("background-color", backColor)
                    .style("padding", "12px 24px")
                    .style("border-radius", "10px")
                    .style("font-size", "20px")
                    .style("white-space", "nowrap")
                    .style("margin", "30px 30px") // Fixed position from left
                    .style("display", "inline-block")
                    .style("text-align","center")
                    .style("cursor", "pointer") // Add pointer cursor to indicate clickability
                    .on("click", function() {
                        // Toggle sentence highlight when time expression is clicked
                        toggleSentenceHighlight(fragment.time.id);
                    });
                positionTimeline++;

                timeBoxes.push({
                    id: fragment.time.id,
                    element: timeBox
                });
            }
        });
    });

    const addedEventIds = new Set();
    const eventBoxes = []
    const timelineColumnRect = timelineColumn.node().getBoundingClientRect();
    const timeExpressionEventCount = new Map();
    allFragments.forEach(fragments => {
        fragments.forEach(fragment => {
            if (fragment.type == "blue-box" && !addedEventIds.has(fragment.event.id)) {

                addedEventIds.add(fragment.event.id);


                if (fragment.event.Class == "I_Action" || fragment.event.Class == "I_State"){
                    borderValue = "2px dashed #3366cc";
                } else{
                    borderValue = "2px solid #99ccff";
                }

                const timeExpressionId = fragment.event.arg2;

                // Track how many events are connected to this time expression
                if (timeExpressionId) {
                    if (!timeExpressionEventCount.has(timeExpressionId)) {
                        timeExpressionEventCount.set(timeExpressionId, 0);
                    }
                    // Increment the count for this time expression
                    const currentCount = timeExpressionEventCount.get(timeExpressionId);
                    timeExpressionEventCount.set(timeExpressionId, currentCount + 1);
                }

                const eventBox = eventsContainer.append("div")
                    .attr("id", `event-${fragment.event.id}`)
                    .style("width", "100px")
                    .style("height", "100px")
                    .style("background-color", "#AF8FBA")
                    .style("border-radius", "50%")
                    .style("display", "flex")
                    .style("align-items", "center")
                    .style("justify-content", "center")
                    .style("font-size", "14px")
                    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                    .style("border", borderValue)
                    .style("position", "absolute")
                    .style("left", function(){
                        const timelineWidth = timelineColumn.node().getBoundingClientRect().width;

                        // If this event is connected to a time expression, add an offset based on position
                        if (timeExpressionId) {
                            const eventPosition = timeExpressionEventCount.get(timeExpressionId) - 1; // 0-based index
                            return (timelineWidth / 2 - 290) + "px";
                        }

                        return (timelineWidth / 2 - 290) + "px";
                    }) // Fixed position from left
                    .style("top", function() {
                        // Find the connected time box and align with it
                        if (fragment.event.arg2) {
                            const connectedTime = timeBoxes.find(t => t.id === fragment.event.arg2);
                            if (connectedTime) {
                                const timeRect = connectedTime.element.node().getBoundingClientRect();
                                const eventPosition = timeExpressionEventCount.get(timeExpressionId) - 1; // 0-based index

                                // Add a small vertical offset (10px) for each subsequent event
                                const verticalOffset = eventPosition * 60;

                                return (timeRect.top - timelineColumnRect.top + timeRect.height/2 - 25 + verticalOffset) + "px";
                            }

                        }
                        return "20px";
                    })
                    .style("pointer-events", "auto")
                    .text(fragment.event.text || "");

                eventBox
                    .on("mouseover", function() {
                        // Show tooltip with event attributes
                        const event = fragment.event;
                        let tooltipContent = "";

                        // List of fields to display (excluding arg2, id, and rel_type)
                        const displayFields = [
                            "Aspect", "Class", "Event_Type", "Polarity",
                            "Pos", "Tense"
                        ];

                        // Build tooltip content
                        displayFields.forEach(field => {
                            if (event[field]) {
                                tooltipContent += `<strong>${field}:</strong> ${event[field]}<br>`;
                            }
                        });

                        tooltip
                            .style("visibility", "visible")
                            .html(tooltipContent);

                        // Position tooltip near the event box
                        const rect = this.getBoundingClientRect();
                        tooltip
                            .style("left", (rect.right + 10) + "px")
                            .style("top", (rect.top) + "px");
                    })
                    .on("mouseout", function() {
                        // Hide tooltip
                        tooltip.style("visibility", "hidden");
                    });


                eventBoxes.push({
                    element: eventBox,
                    fragment: fragment
                });
            }
        });
    });



    function getConnectionPoints(rect1, rect2, isConsecutive, isRightSide) {
        let startX, startY, endX, endY;
        // For consecutive connections that should be on the right side
        if (isConsecutive && isRightSide) {
            // Connect from right side of boxes - This is the key change
            startX = rect1.left + rect1.width;
            startY = rect1.top + rect1.height / 2;

            endX = rect2.left + rect2.width;
            endY = rect2.top + rect2.height / 2;

            return { startX, startY, endX, endY, isVertical: false, isConsecutive: true };
        }

        // Determine if connection should be vertical or horizontal for non-consecutive connections
        const verticalDistance = Math.abs(rect2.top - rect1.top);
        const horizontalDistance = Math.abs(rect2.left - rect1.left);
        // the 90 is just an heuristic to try to fix that
        const isVertical = verticalDistance + 90 > horizontalDistance;


        if (isVertical) {
            // Connect from top or bottom
            startX = rect1.left + rect1.width / 2;
            endX = rect2.left + rect2.width / 2;

            if (rect2.top > rect1.top) {
                // Connect bottom to top
                startY = rect1.top + rect1.height;
                endY = rect2.top;
            } else {
                // Connect top to bottom
                startY = rect1.top;
                endY = rect2.top + rect2.height;
            }
        } else {
            // Connect from sides
            startY = rect1.top + rect1.height / 2;
            endY = rect2.top + rect2.height / 2;

            if (rect2.left > rect1.left) {
                // Connect right to left
                startX = rect1.left + rect1.width;
                endX = rect2.left;
            } else {
                // Connect left to right
                startX = rect1.left;
                endX = rect2.left + rect2.width;
            }
        }

        return { startX, startY, endX, endY, isVertical, isConsecutive: false };
    }

    function createArrows() {
        try {
            //const wrapperRect = wrapper.node().getBoundingClientRect();
            const timelineColumnRect = timelineColumn.node().getBoundingClientRect();

            // Set SVG dimensions
            sharedSVG
                .attr("width", timelineColumnRect.width)
                .attr("height", timelineColumnRect.height);


            allLinkedTimes.flat().forEach(ext => {
                const textElement = document.querySelector(`[id="${ext.id}"]`);
                const arg2Element = document.querySelector(`[id="${ext.arg2}"]`);

                let posArg1 = textElement.getAttribute("position");
                let posArg2 = arg2Element.getAttribute("position");
                const isConsecutive = Math.abs(posArg1 - posArg2) > 1;

                if (!textElement || !arg2Element) return;

                drawConnection(textElement, arg2Element, ext.rel_type, timelineColumnRect,"time", isConsecutive);
            });

            // Draw event-based connections
            allFragments.flat().forEach(fragment => {
                if (fragment.type === "blue-box" && fragment.event && fragment.event.arg2) {
                    const eventElement = document.querySelector(`[id="event-${fragment.event.id}"]`);
                    const timeElement = document.querySelector(`[id="${fragment.event.arg2}"]`);

                    if (!eventElement || !timeElement) return;

                    drawConnection(eventElement, timeElement, fragment.event.rel_type, timelineColumnRect,"event", false);
                }
            });

        } catch (error) {
            console.error("Error in createArrows:", error);
        }
    }

    function drawConnection(element1, element2, relType, wrapperRect, connectionType, isConsecutive) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();

        const timelineColumnRect = timelineColumn.node().getBoundingClientRect();

        const trimmedRelType = relType.includes('_')
            ? relType.split('_')[1]
            : relType;

        const isRightSide = isConsecutive;
        const { startX, startY, endX, endY, isVertical , isConsecutive: isConsec } = getConnectionPoints(
            {
                top: rect1.top - timelineColumnRect.top,
                left: rect1.left - timelineColumnRect.left,
                width: rect1.width,
                height: rect1.height
            },
            {
                top: rect2.top - timelineColumnRect.top,
                left: rect2.left - timelineColumnRect.left,
                width: rect2.width,
                height: rect2.height
            },
            isConsecutive,
            isRightSide
        );

        const pathGroup = sharedSVG.append("g");
        // alternative is to name the path as the joining names of the elements it connects
        const pathId = `connection-path-${Math.random().toString(36).substr(2, 9)}`;

        // Create path
        if (connectionType == "time"){
            if (isConsecutive) {
                // Use special curved path for consecutive time connections on right side
                pathGroup.append("path")
                    .attr("id", pathId)
                    .attr("class", "arrow-path")
                    .attr("fill", "none")
                    .attr("stroke", "DimGray")
                    .attr("stroke-width", 3)
                    .attr("data-rel-type", relType)
                    .attr("d", createRightSideCurvedPath(startX, startY, endX, endY));
            } else{
                pathGroup.append("path")
                    .attr("id", pathId)
                    .attr("class", "arrow-path")
                    .attr("fill", "none")
                    .attr("stroke", "DimGray")
                    .attr("stroke-width", 3)
                    .attr("data-rel-type", relType)
                    .attr("d", createPath(startX, startY, endX, endY, isVertical));
            }

        } else{
            pathGroup.append("path")
                .attr("id", pathId)
                .attr("class", "arrow-path")
                .attr("fill", "none")
                .attr("stroke", "DimGray")
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", "5,5")
                .attr("data-rel-type", relType)
                .attr("d", createCurvedPath(startX, startY, endX, endY, isVertical));
        }

        const textElement = pathGroup.append("text")
            .append("textPath")
            .attr("xlink:href", `#${pathId}`)
            .attr("startOffset", "50%")
            .style("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", "12px")
            .text(trimmedRelType);
    }

    function createRightSideCurvedPath(startX, startY, endX, endY) {
        // Calculate control points for a nice curve on the right side
        // We move the curve outward to the right by adding a significant offset
        const horizontalOffset = 100; // Adjust this value to control how far right the curve extends

        // Calculate the midpoint between the two boxes' vertical positions
        const midY = (startY + endY) / 2;

        // Place control point to the right and at the vertical midpoint
        const cpX = Math.max(startX, endX) + horizontalOffset;
        const cpY = midY;

        return `M ${startX},${startY} Q ${cpX},${cpY} ${endX},${endY}`;
    }
    function createCurvedPath(startX, startY, endX, endY) {
        // Calculate control point (adjust offset for curvature)
        const cpX = (startX + endX) / 2;
        const cpY = (startY + endY) / 2 - 50; // Adjust -50 for curvature strength

        return `M ${startX},${startY} Q ${cpX},${cpY} ${endX},${endY}`;
    }

    function createPath(startX, startY, endX, endY, isVertical) {
        const distance = isVertical
            ? Math.abs(endY - startY)
            : Math.abs(endX - startX);

        const curveOffset = Math.min(distance * 0.2, 20);

        if (isVertical) {
            const midY = (startY + endY) / 2;
            return `M ${startX},${startY} 
                    C ${startX},${startY + curveOffset} 
                      ${endX},${endY - curveOffset} 
                      ${endX},${endY}`;
        } else {
            const midX = (startX + endX) / 2;
            return `M ${startX},${startY} 
                    C ${startX + curveOffset},${startY} 
                      ${endX - curveOffset},${endY} 
                      ${endX},${endY}`;
        }
    }

    createArrows();
    const handleResize = debounce(() => {
        sharedSVG.selectAll("*").remove();

        // Update event positions
        eventBoxes.forEach(eb => {
            const timelineColumnRectCurrent = timelineColumn.node().getBoundingClientRect();

            eb.element
                .style("left", () => {
                    const timelineWidth = timelineColumn.node().getBoundingClientRect().width;
                    return (timelineWidth / 2 - 200) + "px";
                })
                .style("top", function() {
                    if (eb.fragment.event.arg2) {
                        const connectedTime = timeBoxes.find(t => t.id === eb.fragment.event.arg2);
                        if (connectedTime) {
                            const timeRect = connectedTime.element.node().getBoundingClientRect();
                            return (timeRect.top - timelineColumnRectCurrent.top + timeRect.height/2 - 25) + "px";
                        }
                    }
                    return "20px";
                });
        });

        requestAnimationFrame(createArrows);
    }, 100);

    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);

    };
}

function createFragments(text, sentence) {

    let fragments = [];
    let highlights = [
        ...sentence.times.map( time => ({
                text:time.text,
                type: "yellow-box",
                time: time
        })) ,
        ...sentence.events.map(event => ({
            text: event.text,
            type: "blue-box",
            event: event
        }))
    ];

    highlights.forEach(highlight => {
        highlight.index = text.indexOf(highlight.text);
    });

    highlights = highlights.filter(h => h.index !== -1).sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    highlights.forEach(highlight => {
        if (highlight.index > lastIndex) {
            fragments.push({ text: text.substring(lastIndex, highlight.index), type: "normal" });
        }
        fragments.push({ text: highlight.text,
                         type: highlight.type,
                         event: highlight.event,
                         time: highlight.time
         });
        lastIndex = highlight.index + highlight.text.length;
    });

    if (lastIndex < text.length) {
        fragments.push({ text: text.substring(lastIndex), type: "normal" });
    }

    return fragments;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

