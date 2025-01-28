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

    const svg = wrapper
    .insert("svg", ":first-child")
    .attr("class", "arrows")
    .style("pointer-events", "all")
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)
    .style("width", "100%")
    .style("height", "100%")
    .style("z-index", "10")
    .style("background", "rgba(0,0,0,0.01)");


    svg.append("defs")
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

    // Force layout calculation
    sentenceContainer.node().offsetHeight;

    // Initial render after a short delay
    setTimeout(() => {
        //const cleanup =
        initializeArrows(wrapper, eventElements, timeElements, sentence.times);
        //cleanupFunctions.set(index, cleanup);
    }, 100);
}

// Helper function to wait for rendering
function waitForRendering(callback) {
    let cleanup = null;
    let isCleanedUp = false;

    // Chain two animation frames to ensure styles and layout are complete
    requestAnimationFrame(() => {
        if (isCleanedUp) return;

        requestAnimationFrame(() => {
            if (isCleanedUp) return;

            // Use MutationObserver to watch for layout changes
            const observer = new MutationObserver((mutations) => {
                // Debounce the callback to avoid multiple rapid calls
                requestAnimationFrame(() => {
                    if (isCleanedUp) return;

                    if (cleanup) {
                        cleanup();
                    }
                    cleanup = callback();
                });
            });

            // Start observing after initial render
            observer.observe(document.querySelector('#visualization-wrapper'), {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });

            // Initial call
            cleanup = callback();

            // Update the cleanup function to also disconnect the observer
            const originalCleanup = cleanup;
            cleanup = () => {
                observer.disconnect();
                if (originalCleanup) {
                    originalCleanup();
                }
            };
        });
    });

    // Return a cleanup function that handles all cases
    return () => {
        isCleanedUp = true;
        if (cleanup) {
            cleanup();
        }
    };
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
    function createArrows() {
        let svg = wrapper.select("svg.arrows");

        // Check if the SVG exists; if not, create it
        if (svg.empty()) {
            svg = wrapper.append("svg")
                .attr("class", "arrows")
                .style("position", "absolute")
                .style("top", 0)
                .style("left", 0)
                .style("pointer-events", "none")
                .style("z-index", 1);
        }

        const wrapperRect = wrapper.node().getBoundingClientRect();

        // Update SVG dimensions
        svg
            .attr("width", wrapperRect.width)
            .attr("height", wrapperRect.height);

        // Clear old paths
        svg.selectAll("path").remove();

        // Create paths for event-time connections
        eventElements.forEach((eventElement, i) => {
            const timeElement = timeElements[i];
            if (!eventElement || !timeElement) return;

            const eventRect = eventElement.getBoundingClientRect();
            const timeRect = timeElement.getBoundingClientRect();

            svg.append("path")
                .attr("fill", "none")
                .attr("stroke", "black")
                .attr("stroke-width", 1.5)
                .attr("d", createPath(
                    eventRect.left - wrapperRect.left + eventRect.width,
                    eventRect.top - wrapperRect.top + eventRect.height / 2,
                    timeRect.left - wrapperRect.left,
                    timeRect.top - wrapperRect.top + timeRect.height / 2
                ));
        });

        // Add paths for external time connections
        externalTimeElements.forEach(ext => {
            const textElement = document.querySelector(`[data-id="${ext.time_id}"]`);
            const arg2Element = document.querySelector(`[data-id="${ext.arg2}"]`);

            if (!textElement || !arg2Element) return;

            const textRect = textElement.getBoundingClientRect();
            const arg2Rect = arg2Element.getBoundingClientRect();

            svg.append("path")
                .attr("fill", "none")
                .attr("stroke", "blue")
                .attr("stroke-width", 1.5)
                .attr("d", createPath(
                    textRect.left - wrapperRect.left + textRect.width,
                    textRect.top - wrapperRect.top + textRect.height / 2,
                    arg2Rect.left - wrapperRect.left,
                    arg2Rect.top - wrapperRect.top + arg2Rect.height / 2
                ));
        });
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

    // Handle window resize
    const handleResize = () => {
        requestAnimationFrame(createArrows);
    };

    window.addEventListener('resize', handleResize);

    // Return cleanup function
    return () => {
        window.removeEventListener('resize', handleResize);
    };
}


// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateArrows(wrapper, eventElements, timeElements, externalTimeElements) {
    // Ensure wrapper exists in DOM
    if (!document.contains(wrapper.node())) return;

    console.log('Updating arrows', {
    wrapper: wrapper.node(),
    eventElements: eventElements.length,
    timeElements: timeElements.length,
    externalTimeElements: externalTimeElements.length
});

    const svg = d3.select(wrapper.node()).select("svg.arrows");
    const wrapperRect = wrapper.node().getBoundingClientRect();

    // Update SVG dimensions
    svg
        .attr("width", wrapperRect.width)
        .attr("height", wrapperRect.height)
        .style("opacity", 1); // Ensure visibility

    // Validate elements before creating path data
    const eventTimePathData = eventElements.map((eventElement, i) => {
        const timeElement = timeElements[i];
        if (!eventElement || !timeElement || !document.contains(eventElement) || !document.contains(timeElement)) {
            return null;
        }

        const eventNode = d3.select(eventElement).node();
        const timeNode = d3.select(timeElement).node();
        const arg2 = eventNode.getAttribute('arg2');
        const timeId = timeNode.getAttribute('data-id');

        if (!eventNode || !timeNode || timeId !== arg2) return null;

        const startRect = eventNode.getBoundingClientRect();
        const endRect = timeNode.getBoundingClientRect();

        // Validate rectangle dimensions
        if (!startRect.width || !startRect.height || !endRect.width || !endRect.height) {
            return null;
        }

        return {
            startX: startRect.left - wrapperRect.left + startRect.width,
            startY: startRect.top - wrapperRect.top + startRect.height / 2,
            endX: endRect.left - wrapperRect.left,
            endY: endRect.top - wrapperRect.top + endRect.height / 2,
            eventId: eventNode.getAttribute("data-id"),
            timeId: timeId,
            relType: eventNode.getAttribute("data-rel-type"),
            pathType: 'event-time'
        };
    }).filter(Boolean);

    // Similar validation for external time elements
    const externalTimePathData = externalTimeElements.map(externalTimeElement => {
        const textId = externalTimeElement.time_id;
        const arg2 = externalTimeElement.arg2;

        const textElement = document.querySelector(`[data-id="${textId}"]`);
        const arg2Element = document.querySelector(`[data-id="${arg2}"]`);

        if (!textElement || !arg2Element || !document.contains(textElement) || !document.contains(arg2Element)) {
            return null;
        }

        const textRect = textElement.getBoundingClientRect();
        const arg2Rect = arg2Element.getBoundingClientRect();

        // Validate rectangle dimensions
        if (!textRect.width || !textRect.height || !arg2Rect.width || !arg2Rect.height) {
            return null;
        }

        return {
            startX: textRect.left - wrapperRect.left + textRect.width,
            startY: textRect.top - wrapperRect.top + textRect.height / 2,
            endX: arg2Rect.left - wrapperRect.left,
            endY: arg2Rect.top - wrapperRect.top + arg2Rect.height / 2,
            eventId: textId,
            timeId: arg2,
            relType: externalTimeElement.rel_type,
            pathType: 'time-time'
        };
    }).filter(Boolean);

    // Update paths with transition
    function updatePath(selection) {
        selection
            .attr("data-event-id", d => d.eventId)
            .attr("data-time-id", d => d.timeId)
            .attr("data-rel-type", d => d.relType)
            .transition()
            .duration(200)
            .attr("d", d => {
                const midX = (d.startX + d.endX) / 2;
                const midY = (d.startY + d.endY) / 2;
                const distance = Math.sqrt((d.endX - d.startX) ** 2 + (d.endY - d.startY) ** 2);
                const curveHeight = Math.min(distance * 0.5, 100);
                const controlY = midY - curveHeight;
                return `M ${d.startX},${d.startY} Q ${midX},${controlY} ${d.endX},${d.endY}`;
            });
    }

    // Update event-time paths
    const eventTimePaths = svg.selectAll("path.event-time-path")
        .data(eventTimePathData, d => `${d.eventId}-${d.timeId}`);

    eventTimePaths.exit().remove();

    const newEventTimePaths = eventTimePaths.enter()
        .append("path")
        .attr("class", "arrow-path event-time-path")
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 1.5);

    eventTimePaths.merge(newEventTimePaths).call(updatePath);

    // Update time-time paths
    const timeTimePaths = svg.selectAll("path.time-time-path")
        .data(externalTimePathData, d => `${d.eventId}-${d.timeId}`);

    timeTimePaths.exit().remove();

    const newTimeTimePaths = timeTimePaths.enter()
        .append("path")
        .attr("class", "arrow-path time-time-path")
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("stroke-width", 1.5);

    timeTimePaths.merge(newTimeTimePaths).call(updatePath);
}

function drawArrows(wrapper, eventElements, timeElements) {
    const svg = d3.select("svg.arrows");
    const tooltip = d3.select("#tooltip");
    const wrapperRect = wrapper.node().getBoundingClientRect();

    // Add a transparent rect to catch mouse events on entire SVG
    svg.append('rect')
        .attr('width', wrapperRect.width)
        .attr('height', wrapperRect.height)
        .attr('fill', "none")
        .attr('pointer-events', 'all')
        .on('mousemove', function(event) {
            const mouse = d3.pointer(event, this);
            const paths = svg.selectAll('path.arrow-path');

            // Check if mouse is near any path
            paths.each(function() {
                const path = d3.select(this);
                const relType = path.attr('data-rel-type');

                if (isPointNearPath(this, mouse[0], mouse[1])) {
                    tooltip.html(relType)
                        .style("display", "block")
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY + 10) + "px");
                }
            });
        })
        .on('mouseout', function() {
            tooltip.style("display", "none");
        });

    eventElements.forEach((eventElement, i) => {
        const timeElement = timeElements[i];
        if (eventElement && timeElement) {
            const eventNode = d3.select(eventElement).node();
            const timeNode = d3.select(timeElement).node();

            if (!eventNode || !timeNode) return;

            const startRect = eventNode.getBoundingClientRect();
            const endRect = timeNode.getBoundingClientRect();

            const startX = startRect.left - wrapperRect.left + startRect.width;
            const startY = startRect.top - wrapperRect.top + startRect.height / 2;
            const endX = endRect.left - wrapperRect.left;
            const endY = endRect.top - wrapperRect.top + endRect.height / 2;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const curveHeight = Math.min(Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) * 0.5, 100);
            const controlY = midY - curveHeight;

            svg.append("path")
                .attr("d", `M ${startX},${startY} Q ${midX},${controlY} ${endX},${endY}`)
                .attr("fill", "none")
                .attr("stroke", "black")
                .attr("stroke-width", 3)
                .attr("class", "arrow-path")
                .attr("data-rel-type", eventNode.getAttribute("data-rel-type"));
        }
    });
}

// Helper function to check if point is near path
function isPointNearPath(pathElement, x, y, tolerance = 10) {
    const path = pathElement;
    const pathLength = path.getTotalLength();

    for (let i = 0; i < pathLength; i += 5) {
        const point = path.getPointAtLength(i);
        const distance = Math.sqrt(
            Math.pow(point.x - x, 2) +
            Math.pow(point.y - y, 2)
        );

        if (distance < tolerance) {
            return true;
        }
    }

    return false;
}



function renderTimeExpressions(container, times) {
    const timeContainer = container
        .append("div")
        .attr("class", "time-expressions")
        .style("display", "flex")
        .style("gap", "10px");

    /*timeContainer.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "14px")
        .text("Linked Time Expressions");*/




    times.forEach(time => {
        const card = timeContainer
            .append("div")
            .attr("class", "card")
            .style("padding", "10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("background-color", "#fff");

        if (time.text_time2) {
          card.append("div")
            .attr("class", "card-header")
            .style("margin-bottom", "10px")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text(time.text_time2);
        }


        Object.entries(time).forEach(([key, value]) => {
            if (key == "TextTime") return;
            if (key == "arg2") return;
            card.append("div")
                .style("margin-bottom", "5px")
                .style("font-size", "12px")
                .html(`<strong>${key}:</strong> ${value}`);
        });
    });
}


