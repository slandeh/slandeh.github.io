// Extracts the pairings from the pairings.html file, and repackages them into the fancier pairings.html
function extractPairingsAndPopulatePage() {
    const cacheBuster = `cb=${Date.now()}`;
    fetch(`tom-pairings.html?${cacheBuster}`)
        .then((response) => response.text())
        .then((html) => {
            try {
                const headingText = document.getElementById("heading-text");
                headingText.innerText = "Pairings";
                const tablesContainer = document.getElementById("pairings-tables-container");
                tablesContainer.innerHTML = "";
                const eventNameContainer = document.getElementById("event-name");
                eventNameContainer.innerHTML = ""
                const createdOnTimeContainer = document.getElementById("created-on-time");
                createdOnTimeContainer.innerHTML = "";
                const pageRefreshedTimeContainer = document.getElementById("page-refreshed-time");
                pageRefreshedTimeContainer.innerHTML = "";
                const divisionsShortcutButtonsContainer = document.getElementById("divisions-shortcut-buttons-container");
                divisionsShortcutButtonsContainer.innerHTML = "";
                const pairingTablesContainer = document.getElementById("pairings-tables-container");
                pairingTablesContainer.innerHTML = "";
                const now = new Date();
                // match the page refreshed time format to the created on time format: 07/12/2025 15:18:22
                const formattedNow = now.toLocaleDateString("en-US") + " " + now.toLocaleTimeString("en-GB", { hour12: false });
                pageRefreshedTimeContainer.innerHTML = `<h3>Last refreshed on ${formattedNow}</h3>`;

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                // Get pinned player from query string if present
                const urlParams = new URLSearchParams(window.location.search);
                const pinnedPlayer = urlParams.get("player");

                // the 'footers' are td elements with class 'footer'
                const rawFooterData = Array.from(doc.querySelectorAll("td.footer")).map(td => td.innerText.trim());

                // assume that the first footer data is the event name, and the third is the created on time
                if (rawFooterData.length >= 1) {
                    eventNameContainer.innerHTML = `<h2>${rawFooterData[0]}</h2>`;
                }
                if (rawFooterData.length >= 3) {
                    createdOnTimeContainer.innerHTML = `<h3>Generated by TOM on ${rawFooterData[2]}</h3>`;
                }

                // top level pairing text is in an h3, in the format 'Pairings - Round 4'
                const pairingHeader = Array.from(doc.querySelectorAll("h3")).find(h3 => h3.innerText.toLowerCase().includes("pairings"));
                if (pairingHeader) {
                    headingText.innerText = pairingHeader.innerText;
                }

                let rosterMode = false;
                // if an h3 elements contains the word 'Roster', then we're in roster mode
                const rosterHeader = Array.from(doc.querySelectorAll("h3")).find(h3 => h3.innerText.toLowerCase().includes("roster"));
                if (rosterHeader) {
                    rosterMode = true;
                    headingText.innerText = rosterHeader.innerText;
                }
                document.getElementById("roster-mode-text").hidden = !rosterMode;

                // extract each division's tables
                const rawTables = doc.querySelectorAll("table");

                const parsedTables = rawTables.length > 0 ?
                    Array.from(rawTables).map(pairingsTableToJSON).filter(table => table.length > 0)
                    : [];

                // now, find the division names
                // These are in h3 tags, and contain 'Division' in the text
                const divisionHeaders = Array.from(doc.querySelectorAll("h3"))
                    .map(h3 => h3.innerText.replace('--', '-').replace("ivisions", "ivision")).filter((text) =>
                        text.toLowerCase().includes("division")
                    );


                // combine the tables and division names into a single array
                const divisions = [];
                for (let i = 0; i < Math.max(divisionHeaders.length, parsedTables.length); i++) {
                    const divisionName = divisionHeaders[i] || `Division ${i + 1}`;
                    const table = parsedTables[i] || [];
                    // sort the table by pinned player first, then by name
                    const pinnedPlayerLower = (pinnedPlayer ?? '').toLowerCase().replace(/\s+/g, '');
                    table.sort((a, b) => {
                        const aIsPinned = a["Name"].toLowerCase().replace(/\s+/g, '') === (pinnedPlayerLower);
                        const bIsPinned = b["Name"].toLowerCase().replace(/\s+/g, '') === (pinnedPlayerLower);
                        if (aIsPinned && !bIsPinned) return -1;
                        if (!aIsPinned && bIsPinned) return 1;
                        // if both are pinned or both are not pinned, sort by name
                        return (a["Name"] || "").localeCompare(b["Name"] || "");
                    });
                    divisions.push({ name: divisionName, pairings: table });
                }

                // For each division, create a div with the division name and a table of pairings
                const divisionElements = divisions.map((division) => {
                    const divisionDiv = document.createElement("div");
                    divisionDiv.classList.add("division");
                    const divisionHeader = document.createElement("h2");
                    divisionHeader.innerHTML = division.name;

                    // Create a reload button for this division
                    const divisionReloadButton = document.createElement("button");
                    divisionReloadButton.classList.add("division-reload-button");
                    divisionReloadButton.innerHTML = "&#x21bb;";
                    divisionReloadButton.onclick = (e) => {
                        history.replaceState(null, null, '#' + division.name.replace(/\s+/g, '-').toLowerCase());
                        extractPairingsAndPopulatePage();
                    };

                    divisionHeader.appendChild(divisionReloadButton);

                    divisionDiv.appendChild(divisionHeader);

                    // add a shortcut button to the divisions shortcut buttons container
                    const shortcutButton = document.createElement("button");
                    shortcutButton.innerText = division.name.replace("Division", "").trim();
                    shortcutButton.classList.add("division-shortcut-button");
                    shortcutButton.onclick = () => {
                        divisionDiv.scrollIntoView({ behavior: "smooth", block: "start" });
                        // use '#' + division.name as id to update the url hash
                        history.replaceState(null, null, '#' + division.name.replace(/\s+/g, '-').toLowerCase());
                    };
                    divisionsShortcutButtonsContainer.appendChild(shortcutButton);

                    // The table should have the columns 'Table', 'Name', and 'Opponent'
                    const table = document.createElement("table");
                    table.classList.add("pairings-table");
                    const thead = document.createElement("thead");
                    const headerRow = document.createElement("tr");
                    (rosterMode ? ["Player"] : ["Table", "Player 1", "Player 2"]).forEach((col) => {
                        const th = document.createElement("th");
                        th.innerText = col;
                        headerRow.appendChild(th);
                    });
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    const tbody = document.createElement("tbody");
                    division.pairings.forEach((pairing) => {
                        const row = document.createElement("tr");
                        // if the pairing has a 'Name' that matches the pinned player, highlight the row
                        const isPinned = pairing["Name"].toLowerCase().replace(/\s+/g, '') === ((pinnedPlayer ?? '').toLowerCase().replace(/\s+/g, ''));
                        if (isPinned) {
                            row.classList.add("highlighted-row");
                        }
                        if (!rosterMode) {
                            const tableCell = document.createElement("td");
                            tableCell.innerText = pairing["Table"] || "";
                            row.appendChild(tableCell);
                        }
                        const nameCell = document.createElement("td");
                        nameCell.classList.add("player-name-cell");
                        const nameContainer = document.createElement("div");
                        nameContainer.classList.add("player-name-container");
                        const pinButton = document.createElement("button");
                        pinButton.classList.add("pin-button");
                        pinButton.innerHTML = "&#128204;"
                        pinButton.onclick = (e) => {
                            const playerName = pairing["Name"] || "";
                            const url = new URL(window.location.href);
                            if (isPinned) {
                                url.searchParams.delete("player");
                            } else {
                                url.searchParams.set("player", playerName);
                            }
                            history.replaceState(null, null, url.pathname + url.search + '#' + division.name.replace(/\s+/g, '-').toLowerCase());
                            extractPairingsAndPopulatePage();
                        };
                        nameContainer.appendChild(pinButton);
                        nameCell.appendChild(nameContainer);
                        const nameText = document.createElement("span");
                        nameText.classList.add("player-name");
                        nameText.classList.add("player-name-left");
                        nameText.innerText = pairing["Name"] || "";
                        nameContainer.appendChild(nameText);
                        // if the pairing has a record, add it in a pill next to the name
                        if (pairing["playerRecord"]) {
                            const rec = pairing["playerRecord"];

                            // Wrap the win number in a span and set font weight based on wins
                            // const winWeight = Math.min(900, 450 + (rec.wins || 0) * 50);
                            // uncomment the above line and comment the below line for dynamic win font weight
                            const winWeight = 'normal';
                            const recStr = ` <span class="win-count" style="font-weight: ${winWeight}">${rec.wins || 0}</span>/${rec.losses || 0}/${rec.ties || 0}`;
                            const recPill = document.createElement("div");
                            recPill.innerHTML = recStr;
                            recPill.classList.add("record-pill");
                            nameContainer.appendChild(recPill);
                        }
                        row.appendChild(nameCell);
                        if (!rosterMode) {

                            const opponentCell = document.createElement("td");

                            const opponentContainer = document.createElement("div");
                            opponentContainer.classList.add("player-name-container");
                            opponentCell.appendChild(opponentContainer);
                            const opponentText = document.createElement("span");
                            opponentText.classList.add("player-name");
                            opponentText.innerText = pairing["Opponent"] || "";
                            opponentContainer.appendChild(opponentText);
                            // if the pairing has a record, add it in a pill next to the name
                            if (pairing["opponentRecord"]) {
                                const rec = pairing["opponentRecord"];

                                // Wrap the win number in a span and set font weight based on wins
                                // const winWeight = Math.min(900, 450 + (rec.wins || 0) * 50);
                                // uncomment the above line and comment the below line for dynamic win font weight
                                const winWeight = 'normal';
                                const recStr = ` <span class="win-count" style="font-weight: ${winWeight}">${rec.wins || 0}</span>/${rec.losses || 0}/${rec.ties || 0}`;
                                const recPill = document.createElement("div");
                                recPill.innerHTML = recStr;
                                recPill.classList.add("record-pill");
                                opponentContainer.appendChild(recPill);
                            }
                            row.appendChild(opponentCell);
                        }

                        tbody.appendChild(row);
                    });
                    table.appendChild(tbody);
                    divisionDiv.appendChild(table);
                    // Scroll to the hash if present
                    setTimeout(() => {
                        if (window.location.hash) {
                            const hash = window.location.hash.substring(1);
                            if (division.name.replace(/\s+/g, '-').toLowerCase() === hash) {
                                divisionDiv.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                        }
                    }, 100);
                    return divisionDiv;
                });

                if (divisionElements.length === 0) {
                    pairingTablesContainer.innerHTML = "No pairings found."
                } else {
                    divisionElements.forEach((div) => pairingTablesContainer.appendChild(div));
                }

                const reloadButton = document.createElement("button");
                reloadButton.classList.add("reload-button");
                reloadButton.innerHTML = "&#x21bb;";
                divisionsShortcutButtonsContainer.appendChild(reloadButton);
                reloadButton.onclick = () => {
                    reloadButton.disabled = true;
                    reloadButton.innerText = "...";
                    // remove the hash from the url
                    history.replaceState(null, null, window.location.pathname + window.location.search);
                    extractPairingsAndPopulatePage();
                }

            } catch (error) {
                console.error("Error unpacking pairings:", error);
                document.getElementById("root").innerHTML = html;
            }
        })
        .catch((error) => {
            console.error("Error fetching pairings:", error);
        });
}

function pairingsTableToJSON(table) {
    const headers = Array.from(table.querySelectorAll("th")).map((th) => th.innerText.trim());
    const rows = Array.from(table.querySelectorAll("tr")).slice(1); // Skip header row

    return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        const obj = {};
        cells.forEach((cell, index) => {
            const rawText = cell.innerText.trim();
            // the player's row is of the format: 
            // Deb Banerji (2/0/1 (7))
            // which represents:
            // name (wins/losses/ties (points))
            // use a regex to extract the win, loss, draw, and points values if they're present:
            let recordData = null;
            // TODO: Take care of the ' - SR' at the end for mixed divisions
            // TODO: Take care of the * at the end for tardiness
            const match = rawText.match(/^(.*?)(?:\s*\((\d+)\/(\d+)\/(\d+)\s*\((\d+)\).*\)).*?$/);
            if (match) {
                value = match[1].trim();
                recordData = {};
                if (match[2] !== undefined) recordData["wins"] = parseInt(match[2], 10);
                if (match[3] !== undefined) recordData["losses"] = parseInt(match[3], 10);
                if (match[4] !== undefined) recordData["ties"] = parseInt(match[4], 10);
                if (match[5] !== undefined) recordData["points"] = parseInt(match[5], 10);
            } else {
                value = rawText; // fallback to just the raw text
            }
            obj[headers[index]] = value;
            if (headers[index].toLowerCase().trim() === "name" && recordData) {
                obj["playerRecord"] = recordData;
            } else if (headers[index].toLowerCase().trim() === "opponent" && recordData) {
                obj["opponentRecord"] = recordData;
            }
        });
        return obj;
    });
}

// on page load, extract the pairings
window.addEventListener("load", extractPairingsAndPopulatePage);