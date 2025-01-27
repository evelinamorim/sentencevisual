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
            console.log('JSON data fetched:', data); // Debugging log
            d3.select("#visualization").html("");   // Clear existing visualization

            //treeData = convertToTree(data);   // Convert JSON to tree
            //console.log('Tree data:', treeData);    // Debugging log
            // renderD3Tree(treeData);                  // Render with D3.js
            renderSentences(data.sentences);

        })
        .catch(error => console.error('Error fetching JSON data:', error));

    // Convert JSON to tree structure
    function convertToTree(obj, parent = null) {
        let result = { name: name };
        //console.log('Conversion of json to tree of :', obj); // Add this line

        //console.log('Conditions of conversion..', typeof obj === 'object'); // Add this line
        //console.log('Conditions of conversion..', obj !== null); // Add this line
        if (typeof obj === 'object' && obj !== null) {
            result.children = [];
            for (let key in obj) {
                if (Array.isArray(obj[key])) {
                    result.children.push({
                        name: key,
                        children: obj[key].map((item, index) =>
                            convertToTree(item, typeof item === 'object' ? key : item)
                        )
                    });
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    result.children.push(convertToTree(obj[key], key));
                } else {
                    result.children.push({
                        name: `${key}: ${obj[key]}`
                    });
                }
            }
        }
        return result;
    }

    //const treeData = convertToTree(data);
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

    setTimeout(() => drawArrows(wrapper, eventElements, timeElements), 100);
    renderTimeExpressions(sentenceContainer, sentence.times);
}

function createFragments(text, sentence) {
    let fragments = [];
    let highlights = [
        { text: sentence.text_time.replace(",", "").trim(), type: "yellow-box" },
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
        fragments.push({ text: highlight.text, type: highlight.type, event: highlight.event });
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
    let eventElements = [];
    let timeElements = [];

    let eventFragments = []

    fragments.forEach(fragment => {
        let span = sentenceText.append("span")
           .text(fragment.text);

        if (fragment.type !== 'normal') {
            span.attr("class", fragment.type);

            if (fragment.type === "blue-box") {
                if (fragment.event && fragment.event.rel_type) {
                   span.attr("data-rel-type", fragment.event.rel_type);
               }
               eventFragments.push(fragment.event);
               eventElements.push(span.node()); // Store the actual DOM node
            } else if (fragment.type === "yellow-box") {
               timeElements.push(span.node()); // Store the actual DOM node
            }
       }
   });

    // Create a container for the cards below the sentence
    const cardsContainer = d3.select(sentenceText.node().parentNode)
        .append("div")
        .style("display", "flex")
        .style("margin-top", "20px")
        .style("gap", "16px");

   eventFragments.forEach(e => {
        createAttributeCard(
            cardsContainer,
            "Event's Atributes",
            e,
            "#A7C7E7" );
   });

    // Create cards for event and time attributes
    /*if (eventElements.length > 0) {
        createAttributeCard(
            cardsContainer,
            "Event Attributes",
            eventElements[0].attributes,
            "rgba(135, 206, 235, 0.2)" // Light blue background matching the event highlight
        );
    }*/

  return { eventElements, timeElements };
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

function drawArrowsNoLabel(wrapper, eventElements, timeElements) {
    const svg = d3.select("svg.arrows");
    const wrapperRect = wrapper.node().getBoundingClientRect();

    eventElements.forEach((eventElement, i) => {
        const timeElement = timeElements[i];
        if (eventElement && timeElement) {

            const eventNode = d3.select(eventElement).node();
            const timeNode = d3.select(timeElement).node();

            console.log("Event Node",eventNode)

            if (!eventNode || !timeNode) return;

            console.log("Event Node:", eventNode)

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
                .attr("stroke-width", 1.25);
        }
    });
}

function renderTimeExpressions(container, times) {
    const timeContainer = container
        .append("div")
        .attr("class", "time-expressions")
        .style("display", "flex")
        .style("gap", "10px");

    timeContainer.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "14px")
        .text("Linked Time Expressions");

    times.forEach(time => {
        const card = timeContainer
            .append("div")
            .attr("class", "card")
            .style("padding", "10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("background-color", "#fff");

        Object.entries(time).forEach(([key, value]) => {
            card.append("div")
                .style("margin-bottom", "5px")
                .style("font-size", "12px")
                .html(`<strong>${key}:</strong> ${value}`);
        });
    });
}


