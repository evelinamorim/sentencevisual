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
            //console.log('JSON data fetched:', data); // Debugging log
            d3.select("#visualization").html("");   // Clear existing visualization

            //treeData = convertToTree(data);   // Convert JSON to tree
            //console.log('Tree data:', treeData);    // Debugging log
            // renderD3Tree(treeData);                  // Render with D3.js
            renderSentences(data.sentences);

        })
        .catch(error => console.error('Error fetching JSON data:', error));

}

// Render sentences with events and time expressions
function renderSentences(sentences) {
    setupVisualization();
    sentences.forEach((sentence, index) => renderSentence(sentence, index));
}

let sharedSVG;
function setupVisualization() {
    const wrapper = d3.select("#visualization-wrapper");
    const container = d3.select("#visualization").html("");

    wrapper.style("height", "auto");
    wrapper.selectAll("svg.arrows").remove();

    const sentencesContainer = container
        .append("div")
        .attr("class", "sentences-container")
        .style("position", "relative")
        .style("z-index", "2");

    sharedSVG = wrapper
        .append("svg")
        .attr("class", "arrows")
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "all")
        .style("z-index", "10");

    sharedSVG.append("defs")
        .append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "black");
}

const cleanupFunctions = new Map();

function renderSentence(sentence, index) {
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

    // Wait for DOM to be fully rendered before initializing arrows
    requestAnimationFrame(() => {
        const cleanup = initializeArrows(wrapper, eventElements, timeElements, sentence.times);
        if (typeof cleanupFunctions !== 'undefined') {
            cleanupFunctions.set(index, cleanup);
        }
    });
}


function createFragments(text, sentence) {
    let fragments = [];
    let highlights = [
        { text: sentence.text_time.replace(",", "").trim(),
          type: "yellow-box" ,
          TemporalFunction: sentence.TemporalFunction,
          TimeType: sentence.Time_Type,
          TimeId: sentence.time_id},
        ...sentence.events.map(event => ({
            text: event.text_event,
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
                         TemporalFunction: highlight.TemporalFunction,
                         TimeType: highlight.TimeType,
                         TimeId: highlight.TimeId
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
    const spans = fragments.map(fragment => {
        const span = sentenceText.append("span")
            .text(fragment.text);

        if (fragment.type !== 'normal') {
            span.attr("class", fragment.type)
                .style("position", "relative")
                .style("display", "inline-block"); // Ensure stable layout
        }

        return span;
    });

    // Then collect and configure special elements
    const eventElements = [];
    const timeElements = [];
    const eventFragments = [];
    const timeFragments = [];

    spans.forEach((span, i) => {
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
    });

    // Create cards container with explicit positioning
    const cardsContainer = d3.select(sentenceText.node().parentNode)
        .append("div")
        .style("display", "flex")
        .style("margin-top", "20px")
        .style("gap", "16px")
        .style("position", "relative");

    // Create cards
    eventFragments.forEach(e => createAttributeCard(cardsContainer, "Event's Atributes", e, "#A7C7E7"));
    timeFragments.forEach(t => createAttributeCard(cardsContainer, "Time's Atributes", t, "rgba(255, 255, 0, 0.2)"));

    return { eventElements, timeElements };
}


function initializeArrows(wrapper, eventElements, timeElements, externalTimeElements) {
    let tooltip;


    function createArrows() {
        try {
             console.log(wrapper.selectAll("svg.arrows"));
             console.log(sharedSVG);
            // Remove old SVG if it exists
            if (sharedSVG) {
                sharedSVG.selectAll(".arrow-path, rect").remove();
            }

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
            svg
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
                    .attr("stroke", "black")
                    .attr("stroke-width", 1.5)
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
                    .attr("stroke-width", 1.5)
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
        console.log("handleMouseMove")

        if (!sharedSVG || sharedSVG.empty() || !tooltip) return;

        const mouse = d3.pointer(event, this);
        const paths = sharedSVG.selectAll("path.arrow-path");
        let foundPath = false;

        paths.each(function() {
            const path = d3.select(this);

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
        requestAnimationFrame(createArrows);
    }, 100);

    window.addEventListener('resize', handleResize);

    function cleanup() {
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


