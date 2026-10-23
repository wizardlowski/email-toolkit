<script lang="ts" setup>
import Papa from 'papaparse'

useHead({
  title: 'Spotlight Logic'
})
definePageMeta({
  name: 'Spotlight Logic'
})

const selectedPodType = ref('')
function setPodType(selected: string) {
    selectedPodType.value = selected
}

type Rating = {
  critic?: string
  critic_cert_fresh?: boolean
  audience?: string
  audience_ver_hot?: boolean
}

type Show = {
  title: string
  channel: string
  image: string
  alt: string
  copyright: string
  rating: Rating | false
  tx?: string
  description?: string
}

type OrderRow = {
  comment: string
  order: string[]
}

const inputShows = ref('')
const inputOrders = ref('')
const inputsAdded = ref(false)
const outputLogic = ref('')

function isAddon(show: Show): boolean {
    return show.channel.includes('cinema') || show.channel.includes('sport') || show.channel.includes('kids')
}

function addonImage(show: Show): string {
    if (show.channel.includes('cinema')) return 'images/spot-cin.jpg'
    if (show.channel.includes('sport')) return 'images/spot-spt.jpg'
    if (show.channel.includes('kids')) return 'images/spot-kids.jpg'
    return ''
}

function convert() {
    inputsAdded.value = true
    const allShows = convertShowRowsToJson(inputShows.value, selectedPodType.value);
    const orders = convertOrderRowsToJson(inputOrders.value);

    // Spotlight only: split cinema/sport/kids addons out from TV shows.
    let shows = allShows
    let addons: Show[] = []
    if (selectedPodType.value === 'spotlight') {
        addons = allShows.filter(isAddon)
        shows = allShows.filter(show => !isAddon(show))

        // set image paths
        shows.forEach((show, i) => { show.image = `images/spot-tv-${i + 1}.jpg` })
        addons.forEach(show => { show.image = addonImage(show) })
    }

    const ordersAndShows = compileShowOrders(shows, orders, selectedPodType.value);
    outputLogic.value = compileWithLogic(shows, ordersAndShows, addons, selectedPodType.value);
}

// collapse line breaks/extra whitespace into a single line
function singleLine(text = ''): string {
    return text.replace(/\s+/g, ' ').trim()
}

// multi-line cell -> <br> separated copy
function toBreaks(text = ''): string {
    return text.trim().replace(/\n\n/g, '\n').replace(/\n/g, '<br>')
}

function convertShowRowsToJson(rows: string, pod: string): Show[] {
    // Sheets have blank spacer columns, so parse raw tabs and map by index
    const parsedRows = Papa.parse<string[]>(rows, {
        delimiter: '\t',
        skipEmptyLines: true
    }).data

    // Format rows into objects
    let showObjects: Show[] = [];

    parsedRows.forEach((rawRow, index) => {
        const row = rawRow.map(cell => /^n\/a$/i.test(cell.trim()) ? '' : cell)

        // Spotlight: title | spacer | channel | spacer | body | spacer | tx | tomScore | tomRating | popcornScore | popcornRating | copyright
        // Top 5:     title | spacer | channel | spacer | tx   | spacer | blank | (same as above)
        let [title, , channel, , extraText, , tx = "", tomScore = "", tomRating = "", popcornScore = "", popcornRating = "", copyright = ""] = row;

        title = singleLine(title)
        extraText = toBreaks(extraText)
        tx = toBreaks(tx)
        copyright = copyright.trim()

        const rating: Rating = {};

        if (tomScore && tomRating) {
            rating.critic = tomScore.replace("%", "");
        }
        if (tomRating?.toLowerCase().includes("certified")) {
            rating.critic_cert_fresh = true;
        }
        if (popcornScore && popcornRating) {
            rating.audience = popcornScore.replace("%", "");
        }
        if (popcornRating?.toLowerCase().includes("verified")) {
            rating.audience_ver_hot = true;
        }

        let channelName = channel?.trim().replaceAll(" ", "_").toLowerCase() || '';
        if (channelName.includes("sports")) {
            channelName = channelName.replace("sky_", "");
        }
        if (channelName.includes("disney")) {
            channelName = "disney"
        }

        const imagePath = pod === "top5" ? `images/Top-${index + 1}.jpg` : '';

        let showObject: Show = {
            title,
            channel: channelName,
            image: imagePath,
            alt: title,
            ...(pod === 'top5' ? { tx: extraText } : { description: extraText, tx }),
            copyright,
            rating: Object.keys(rating).length ? rating : false
        };
        
        showObjects.push(showObject)
    });

    return showObjects;
}

function convertOrderRowsToJson(rows: string): string[][] {
    const parsedRows = Papa.parse<string[]>(rows, {
        delimiter: '\t',
        skipEmptyLines: true
    }).data

    const firstRow = parsedRows[0];
    if (!firstRow) return [];

    // transpose rows -> columns, dropping blank spacer columns
    const orderObjects = firstRow
        .map((_, colIndex) => parsedRows.map(row => row[colIndex] ?? ''))
        .filter(col => col.some(cell => cell.trim()));

    return orderObjects;
}

function compileShowOrders(showsData: Show[], orders: string[][], pod: string): OrderRow[] {
    const showTitles = showsData.map(show => show.title.toLowerCase());

    const orderArray: OrderRow[] = [];
    const podType = pod === 'top5' ? 'top_shows' : 'spotlight_shows';

    orders.forEach(order => {
        const orderRow: OrderRow = {
            comment: '// ',
            order: []
        };
        order.forEach((title, index) => {
            const cleanTitle = singleLine(title);
            const showIndex = showTitles.indexOf(cleanTitle.toLowerCase());
            orderRow.comment += cleanTitle;
            index < order.length - 1 ? orderRow.comment += ', ' : '';
            orderRow.order.push(`${podType}[${showIndex}]`);
        });
        orderArray.push(orderRow);
    });

    return orderArray;
}

function compileWithLogic(showsData: Show[], showOrders: OrderRow[], addons: Show[], pod: string): string {
    const conditions = [
    'isSOIP_ETV',
    'isSOIP_UTV',
    'isSkyQ && hasNetflix',
    'isSkyQ && !hasNetflix',
    'isSkyPlus'
    ];

    let output = [];
    let podType = pod === 'top5' ? 'top' : 'spotlight';

    output.push(`var ${podType}_shows = ` + JSON.stringify(showsData, null, 2));
    output.push(`var ${podType} = [];`);
    
    conditions.forEach((condition, index) => {
        output.push(`if (${condition}) {`);
        output.push('\t' + showOrders[index]?.comment);
        output.push(`\t${podType} = [${showOrders[index]?.order}];`);
        output.push('}');
    });

    if (podType === 'spotlight') {
        // add cinema/sport/kids here - logic is in the template already
        const cinema = addons.filter(show => show.channel.includes('cinema'))[0]
        const sports = addons.filter(show => show.channel.includes('sports'))[0]
        const kids = addons.filter(show => show.channel.includes('kids'))[0]
        output.push('\n// Cinema / Sport / Kids options');
        output.push(`var spotlight_cinema = ` + JSON.stringify(cinema, null, 2));
        output.push(`var spotlight_sports = ` + JSON.stringify(sports, null, 2));
        output.push(`var spotlight_kids = ` + JSON.stringify(kids, null, 2));
    }

    return output.join('\n');
}

// -1 index = order title not found in shows (usually a title mismatch)
const hasMissingTitle = computed(() => /_shows\[-1\]/.test(outputLogic.value))

const { copy } = useClipboard()
const copyBtnText = ref('copy to clipboard')

function clipboardCopy () {
copy(outputLogic.value)
copyBtnText.value = 'copied!'

setTimeout(() => {
    copyBtnText.value = 'copy to clipboard'
}, 1000)
}

function reset() {
    selectedPodType.value = ''
    inputShows.value = ''
    inputOrders.value = ''
    inputsAdded.value = false
    outputLogic.value = ''
}
</script>
<template>
    <div v-if="!selectedPodType">
        <p  class="my-4 text-center">
            Select which content pod you need
        </p>
        <div class="flex justify-center gap-4">
            <UButton @click="setPodType('top5')">Top 5</UButton>
            <UButton @click="setPodType('spotlight')">Spotlight</UButton>
        </div>
    </div>

    <div v-else class="h-full">
        <div v-if="!inputsAdded" class="grid gap-4 grid-cols-2 items-start p-4">
            <h2 class="col-span-full text-center text-2xl">{{ selectedPodType === 'top5' ? 'Top 5' : 'Spotlight'  }}</h2>
            <UTextarea v-model="inputShows" :rows="14" :ui="{ base: 'resize-none' }" placeholder="Add shows here" autofocus />
            <UTextarea v-model="inputOrders" :rows="14" :ui="{ base: 'resize-none' }" placeholder="Add content orders here" />
            <div class="col-span-full text-center">
                <UButton @click="convert">Turn this into something useful</UButton>
            </div>
        </div>
        <div v-else class="grid gap-4 grid-cols-2 h-full">
            <UTextarea v-model="outputLogic" :ui="{ base: 'resize-none h-full' }" />

            <div class="grid place-content-center gap-8">
                <UAlert
                    v-if="hasMissingTitle"
                    color="warning"
                    variant="subtle"
                    icon="i-lucide-triangle-alert"
                    title="Title mismatch in content orders"
                    description="Look for [-1] in the output. A show title in the content orders doesn't match the shows list."
                    :ui="{ title: 'text-amber-900 dark:text-warning', description: 'text-amber-900 dark:text-warning', icon: 'text-amber-700 dark:text-warning' }"
                />
                <UButton @click="clipboardCopy">
                {{ copyBtnText }}
                </UButton>
                <UButton @click="reset">
                    Go again
                </UButton>
            </div>
        </div>
    </div>
</template>