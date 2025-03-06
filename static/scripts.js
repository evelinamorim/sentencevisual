const tooltip = d3.select("#tooltip");

function populateFileDropdown() {
    fetch('/get-files')
        .then(response => response.json())
        .then(files => {
            const fileSelect = document.getElementById('fileSelect');

            // Clear existing options (if any)
            fileSelect.innerHTML = '<option value="">Select a file</option>';

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

// Render sentences with events and time expressions
function renderSentences(sentences) {
    setupVisualization();
    console.log(sentences)
    const results = sentences.map((sentence, index) => renderSentenceTimeline(sentence, index));

    const allFragments = results.map(r => r.fragments);
    const allLinkedTimes = results.map(r => r.linkedTimes);

    const cleanup = renderTimeline(allFragments, allLinkedTimes);

}

let sharedSVG;
function setupVisualization() {
    const wrapper = d3.select("#visualization-wrapper");
    wrapper.style("height", "auto");
    wrapper.style("position", "relative");
    wrapper.style("margin","20px")

    const container = d3.select("#visualization")
        .html("")
        .style("position", "relative")
        .style("z-index", "2");

    wrapper.selectAll("svg.arrows").remove();

    sharedSVG = wrapper.append("svg")
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
        .attr("fill", "black");

}

const cleanupFunctions = new Map();

function renderTimeline(allFragments, allLinkedTimes) {


    const wrapper = d3.select("#visualization-wrapper");

    const timelineContainer = wrapper.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center")
        .style("gap", "20px")
        .style("margin", "20px");

    const eventsContainer = wrapper.append("div")
        .style("position", "absolute")
        .style("left", "0")
        .style("top", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none");

    const timeBoxes = [];
    // Render yellow boxes
    allFragments.forEach(fragments => {
        fragments.forEach(fragment => {
            if (fragment.type === "yellow-box") {
                const timeBox = timelineContainer.append("span")
                    .attr("id", fragment.time.id)
                    .text(fragment.text)
                    .classed("yellow-box", true)
                    .style("background-color", "#ffff00")
                    .style("padding", "12px 24px")
                    .style("border-radius", "10px")
                    .style("font-size", "20px")
                    .style("white-space", "nowrap")
                    .style("margin", "20px") // Fixed position from left
                    .style("display", "inline-block")
                    .style("text-align","center");

                timeBoxes.push({
                    id: fragment.time.id,
                    element: timeBox
                });
            }
        });
    });

    const eventBoxes = []
    allFragments.forEach(fragments => {
        fragments.forEach(fragment => {
            if (fragment.type == "blue-box") {
                const eventBox = eventsContainer.append("div")
                    .attr("id", `event-${fragment.event.id}`)
                    .style("width", "50px")
                    .style("height", "50px")
                    .style("background-color", "#b3d9ff")
                    .style("border-radius", "50%")
                    .style("display", "flex")
                    .style("align-items", "center")
                    .style("justify-content", "center")
                    .style("font-size", "14px")
                    .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                    .style("border", "2px solid #99ccff")
                    .style("position", "absolute")
                    .style("left", function(){
                        const wrapperWidth = wrapper.node().getBoundingClientRect().width;
                        return (wrapperWidth / 2 - 200) + "px";
                    }) // Fixed position from left
                    .style("top", function() {
                        // Find the connected time box and align with it
                        if (fragment.event.arg2) {
                            const connectedTime = timeBoxes.find(t => t.id === fragment.event.arg2);
                            if (connectedTime) {
                                const timeRect = connectedTime.element.node().getBoundingClientRect();
                                const wrapperRect = wrapper.node().getBoundingClientRect();
                                return (timeRect.top - wrapperRect.top + timeRect.height/2 - 25) + "px";
                            }
                        }
                        return "20px"; // Default position
                    })
                    .text(fragment.event.text || "");
                eventBoxes.push({
                    element: eventBox,
                    fragment: fragment
                });
            }
        });
    });



    function getConnectionPoints(rect1, rect2) {
        // Determine if connection should be vertical or horizontal
        const verticalDistance = Math.abs(rect2.top - rect1.top);
        const horizontalDistance = Math.abs(rect2.left - rect1.left);
        const isVertical = verticalDistance > horizontalDistance;

        let startX, startY, endX, endY;

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

        return { startX, startY, endX, endY, isVertical };
    }

    function createArrows() {
        try {
            const wrapperRect = wrapper.node().getBoundingClientRect();

            // Set SVG dimensions
            sharedSVG
                .attr("width", wrapperRect.width)
                .attr("height", wrapperRect.height);


            allLinkedTimes.flat().forEach(ext => {
                const textElement = document.querySelector(`[id="${ext.id}"]`);
                const arg2Element = document.querySelector(`[id="${ext.arg2}"]`);

                if (!textElement || !arg2Element) return;

                drawConnection(textElement, arg2Element, ext.rel_type, wrapperRect,"time");
            });

            // Draw event-based connections
            allFragments.flat().forEach(fragment => {
                if (fragment.type === "blue-box" && fragment.event && fragment.event.arg2) {
                    const eventElement = document.querySelector(`[id="event-${fragment.event.id}"]`);
                    const timeElement = document.querySelector(`[id="${fragment.event.arg2}"]`);

                    if (!eventElement || !timeElement) return;

                    drawConnection(eventElement, timeElement, fragment.event.rel_type, wrapperRect,"event");
                }
            });

        } catch (error) {
            console.error("Error in createArrows:", error);
        }
    }

    function drawConnection(element1, element2, relType, wrapperRect, connectionType) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();

        const trimmedRelType = relType.includes('_')
            ? relType.split('_')[1]
            : relType;

        const { startX, startY, endX, endY, isVertical } = getConnectionPoints(
            {
                top: rect1.top - wrapperRect.top,
                left: rect1.left - wrapperRect.left,
                width: rect1.width,
                height: rect1.height
            },
            {
                top: rect2.top - wrapperRect.top,
                left: rect2.left - wrapperRect.left,
                width: rect2.width,
                height: rect2.height
            }
        );

        const pathGroup = sharedSVG.append("g");
        // TODO: alternative is to name the path as the joining names of the elements it connects
        const pathId = `connection-path-${Math.random().toString(36).substr(2, 9)}`;

        // Create path
        if (connectionType == "time"){
            pathGroup.append("path")
                .attr("id", pathId)
                .attr("class", "arrow-path")
                .attr("fill", "none")
                .attr("stroke", "DimGray")
                .attr("stroke-width", 3)
                .attr("data-rel-type", relType)
                .attr("d", createPath(startX, startY, endX, endY, isVertical));
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
            const wrapperWidth = wrapper.node().getBoundingClientRect().width;

            eb.element
                .style("left", () => {
                    return (wrapperWidth / 2 - 200) + "px";
                })
                .style("top", function() {
                    if (eb.fragment.event.arg2) {
                        const connectedTime = timeBoxes.find(t => t.id === eb.fragment.event.arg2);
                        if (connectedTime) {
                            const timeRect = connectedTime.element.node().getBoundingClientRect();
                            const wrapperRect = wrapper.node().getBoundingClientRect();
                            return (timeRect.top - wrapperRect.top + timeRect.height/2 - 25) + "px";
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

function renderSentenceTimeline(sentence, index) {
    const wrapper = d3.select("#visualization-wrapper");
    const container = d3.select(".sentences-container");

    const sentenceContainer = container
        .append("div")
        .attr("class", "sentence")
        .style("position", "relative")
        .style("z-index", "2");

    const sentenceText = sentenceContainer
        .append("div")
        .style("position", "relative")
        .style("z-index", "2");

    const fragments = createFragments(sentence.text, sentence);
    //const { eventElements, timeElements } = categorizeElements(sentenceText, fragments);
    return {
        fragments: fragments,
        linkedTimes: sentence.linked_times
    };
}

function renderSentenceMode(sentence, index) {
    const wrapper = d3.select("#visualization-wrapper");
    const container = d3.select(".sentences-container");

    const sentenceContainer = container
        .append("div")
        .attr("class", "sentence")
        .style("position", "relative")
        .style("z-index", "2");

    const sentenceText = sentenceContainer
        .append("div")
        .style("position", "relative")
        .style("z-index", "2");

    const fragments = createFragments(sentence.text_sent, sentence);
    const { eventElements, timeElements } = categorizeElements(sentenceText, fragments);


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


function createAttributeCard(container, title, attributes, backgroundColor) {
    const card = container.append("div")
        .attr("class", "attribute-card")
        .style("background-color", backgroundColor); // Keep dynamic background color here

    // Add title
    card.append("div")
        .attr("class", "attribute-card-title")
        .text(title);

    // Add attributes
    const attributeList = card.append("table")
        .attr("class", "attribute-card-list");

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === "rel_type") return;
        const row = attributeList.append("tr");
        // Term
        row.append("td")
            .attr("class", "attribute-card-term")
            .text(`${key}:`);

        // Definition
        row.append("dd")
            .attr("class", "attribute-card-definition")
            .text(value);
    });

    return card;
}



function categorizeElements(sentenceText, fragments) {
    // Create all spans first
    /*const spans = fragments.map(fragment => {
        const span = sentenceText.append("span")
            .text(fragment.text);

        if (fragment.type !== 'normal') {
            span.attr("class", fragment.type)
                .style("position", "relative")
                .style("display", "inline-block"); // Ensure stable layout
        }

        return span;
    });*/

    // Then collect and configure special elements
    const eventElements = [];
    const timeElements = [];
    const eventFragments = [];
    const timeFragments = [];

    /*spans.forEach((span, i) => {
        const fragment = fragments[i];
        if (fragment.type === "blue-box") {
            span.attr("data-rel-type", fragment.event?.rel_type || '')
                .attr("data-id", fragment.event?.event_id || '')
                .attr("arg2", fragment.event?.arg2 || '');

            eventFragments.push(fragment.event);
            eventElements.push(span.node());
        } else if (fragment.type === "yellow-box") {
            const timeFragment = {
                TemporalFunction: fragment.TemporalFunction,
                TimeType: fragment.TimeType
            };

            span.attr("data-id", fragment.TimeId);
            timeFragments.push(timeFragment);
            timeElements.push(span.node());
        }
    });*/

    // Create cards container with explicit positioning
    const cardsContainer = d3.select(sentenceText.node().parentNode)
        .append("div")
        .style("display", "flex")
        .style("margin-top", "20px")
        .style("gap", "16px")
        .style("position", "relative");

    // Create cards
    // eventFragments.forEach(e => createAttributeCard(cardsContainer, "Event's Atributes", e, "#A7C7E7"));
    //timeFragments.forEach(t => createAttributeCard(cardsContainer, "Time's Atributes", t, "rgba(255, 255, 0, 0.2)"));

    return { eventElements, timeElements };
}


function initializeArrows(wrapper, eventElements, timeElements, externalTimeElements) {
    let tooltip;


    function createArrows() {
        try {


            // Create new SVG and store it in the outer scope
            /*svg = wrapper.append("svg")
                .attr("class", "arrows")
                .style("position", "absolute")
                .style("top", 0)
                .style("left", 0)
                .style("pointer-events", "all")
                .style("z-index", 1);*/

            const wrapperRect = wrapper.node().getBoundingClientRect();

            // Set SVG dimensions
            sharedSVG
                .attr("width", wrapperRect.width)
                .attr("height", wrapperRect.height);

            // Create paths data
            eventElements.forEach((eventElement, i) => {
                const timeElement = timeElements[i];
                if (!eventElement || !timeElement) return;

                const eventRect = eventElement.getBoundingClientRect();
                const timeRect = timeElement.getBoundingClientRect();

                sharedSVG.append("path")
                    .attr("class", "arrow-path")
                    .attr("fill", "none")
                    .attr("stroke", "red")
                    .attr("stroke-width", 3)
                    .attr("data-rel-type", d3.select(eventElement).attr("data-rel-type"))
                    .attr("d", createPath(
                        eventRect.left - wrapperRect.left + eventRect.width,
                        eventRect.top - wrapperRect.top + eventRect.height / 2,
                        timeRect.left - wrapperRect.left,
                        timeRect.top - wrapperRect.top + timeRect.height / 2
                    ));
            });

            // Add external time paths
            externalTimeElements.forEach(ext => {
                const textElement = document.querySelector(`[data-id="${ext.time_id}"]`);
                const arg2Element = document.querySelector(`[data-id="${ext.arg2}"]`);

                if (!textElement || !arg2Element) return;

                const textRect = textElement.getBoundingClientRect();
                const arg2Rect = arg2Element.getBoundingClientRect();

                sharedSVG.append("path")
                    .attr("class", "arrow-path")
                    .attr("fill", "none")
                    .attr("stroke", "blue")
                    .attr("stroke-width", 3)
                    .attr("data-rel-type", ext.rel_type)
                    .attr("d", createPath(
                        textRect.left - wrapperRect.left + textRect.width,
                        textRect.top - wrapperRect.top + textRect.height / 2,
                        arg2Rect.left - wrapperRect.left,
                        arg2Rect.top - wrapperRect.top + arg2Rect.height / 2
                    ));
            });

            // Create tooltip if it doesn't exist
            tooltip = d3.select("#tooltip");
            if (tooltip.empty()) {
                tooltip = d3.select("body")
                    .append("div")
                    .attr("id", "tooltip")
                    .style("position", "absolute")
                    .style("display", "none")
                    .style("background", "white")
                    .style("padding", "5px")
                    .style("border", "1px solid #ccc")
                    .style("border-radius", "4px")
                    .style("pointer-events", "none")
                    .style("z-index", "1000");
            }


            sharedSVG.append("rect")
                .attr("width", wrapperRect.width)
                .attr("height", wrapperRect.height)
                .attr("fill", "transparent")
                .style("pointer-events", "all")
                .on("mousemove", handleMouseMove)
                .on("mouseout", handleMouseOut);

        } catch (error) {
            console.error("Error in createArrows:", error);
        }
    }

    function handleMouseMove(event) {


        if (!sharedSVG || sharedSVG.empty() || !tooltip) return;

        const mouse = d3.pointer(event, this);
        const paths = sharedSVG.selectAll("path.arrow-path");
        let foundPath = false;

        paths.each(function() {
            const path = d3.select(this);
            console.log(isPointNearPath(this, mouse[0], mouse[1]))
            if (isPointNearPath(this, mouse[0], mouse[1])) {
                const relType = path.attr("data-rel-type");
                tooltip
                    .html(relType)
                    .style("display", "block")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px");
                foundPath = true;
            }
        });

        if (!foundPath) {
            tooltip.style("display", "none");
        }
    }

    function handleMouseOut() {
        if (tooltip) {
            tooltip.style("display", "none");
        }
    }

    function isPointNearPath(pathNode, x, y, threshold = 5) {
        if (!pathNode) return false;

        const pathLength = pathNode.getTotalLength();
        let start = 0;
        let end = pathLength;
        let closest = Infinity;

        while (start <= end) {
            const mid = (start + end) / 2;
            const point = pathNode.getPointAtLength(mid);
            const distance = Math.sqrt(
                Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
            );
            closest = Math.min(closest, distance);

            if (closest <= threshold) {
                return true;
            }

            const nextPoint = pathNode.getPointAtLength(mid + 1);
            const direction = (nextPoint.x - point.x) * (y - point.y) -
                            (nextPoint.y - point.y) * (x - point.x);

            if (direction > 0) {
                end = mid - 1;
            } else {
                start = mid + 1;
            }
        }

        return closest <= threshold;
    }

    function createPath(startX, startY, endX, endY) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        const curveHeight = Math.min(distance * 0.5, 100);
        const controlY = midY - curveHeight;
        return `M ${startX},${startY} Q ${midX},${controlY} ${endX},${endY}`;
    }

    // Initial creation
    createArrows();

    // Handle window resize with debounce
    const handleResize = debounce(() => {
                                // Remove old SVG if it exists
            if (sharedSVG) {
                sharedSVG.selectAll(".arrow-path, rect").remove();
            }
        requestAnimationFrame(createArrows);
    }, 100);

    window.addEventListener('resize', handleResize);

    function cleanup() {
    console.log("Cleanup function")

        window.removeEventListener('resize', handleResize);
        if (sharedSVG && !sharedSVG.empty()) {
            sharedSVG.remove();
        }
        if (tooltip && !tooltip.empty()) {
            tooltip.remove();
        }
    }

    return cleanup;
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


