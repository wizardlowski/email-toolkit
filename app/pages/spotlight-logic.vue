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

function convert() {
    inputsAdded.value = true
    const shows = convertShowRowsToJson(inputShows.value, selectedPodType.value);;
    const orders = convertOrderRowsToJson(inputOrders.value);
    const ordersAndShows = compileShowOrders(shows, orders, selectedPodType.value);

    outputLogic.value = compileWithLogic(shows, ordersAndShows, selectedPodType.value);
}

function convertShowRowsToJson(rows: string, pod: string): Show[] {
    // Sort out line breaks/tabs/quotes and then split based on line break
    const rowsSingleTab = rows.replace(/\t\t/g, "\t")
    const parsedRows = Papa.parse<string[]>(rowsSingleTab, {
        delimiter: '\t',
        skipEmptyLines: true
    }).data

    // Format rows into objects
    let showObjects: Show[] = [];
    
    parsedRows.forEach((row, index) => {
        let [title, channel, extraText, tomScore = "", tomRating = "", popcornScore = "", popcornRating = "", copyright = "" ] = row;

        title = title?.replace(/\n/g, ' ')
        extraText = extraText?.replace(/\n\n/g, '\n')
        extraText = extraText?.replace(/\n/g, '<br>')

        tomScore = tomScore?.replace(/N\/A/g, '')
        tomRating = tomRating?.replace(/N\/A/g, '')
        popcornScore = popcornScore?.replace(/N\/A/g, '')
        popcornRating = popcornRating?.replace(/N\/A/g, '')

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

        let channelName = channel?.replaceAll(" ", "_").toLowerCase() || '';
        if (channelName.includes("sports")) {
            channelName = channelName.replace("sky_", "");
        }

        let showObject: Show = {
            title: title ?? '',
            channel: channelName,
            image: `images/Top-${index + 1}.jpg`,
            alt: title ?? '',
            ...(pod === 'top5' ? { tx: extraText ?? '' } : { description: extraText ?? '' }),
            copyright: copyright ? copyright : '',
            rating: Object.keys(rating).length ? rating : false
        };
        
        showObjects.push(showObject)
    });

    return showObjects;
}

function convertOrderRowsToJson(rows: string): string[][] {
    const rowsSingleTab = rows.replace(/\t\t/g, "\t")
    const parsedRows = Papa.parse<string[]>(rowsSingleTab, {
        delimiter: '\t',
        skipEmptyLines: true
    }).data

    const rows2D = parsedRows;
    const firstRow = parsedRows[0];
    if (!firstRow) return [];

    const orderObjects = firstRow.map((_, colIndex) =>
        rows2D.map(row => row[colIndex] ?? '')
    );

    return orderObjects;
}

function compileShowOrders(shows: Show[], orders: string[][], pod: string): OrderRow[] {
    const showTitles = shows.map(show => show.title.toLowerCase());

    let orderArray: OrderRow[] = [];
    let podType = pod === 'top5' ? 'top_shows' : 'spotlight_shows';
    orders.forEach(order => {
        const orderRow: OrderRow = {
            comment: '// ',
            order: []
        };
        order.forEach((title, index) => {
            const showIndex = showTitles.indexOf(title.trim().toLowerCase());
            orderRow.comment += `${title.trim()}`;
            index < order.length - 1 ? orderRow.comment += ', ' : '';
            orderRow.order.push(`${podType}[${showIndex}]`);
        });
        orderArray.push(orderRow);
    });

    return orderArray;
}

function compileWithLogic(shows: Show[], showOrders: OrderRow[], pod: string): string {
    const conditions = [
    'isSOIP_ETV',
    'isSOIP_UTV',
    'isSkyQ && hasNetflix',
    'isSkyQ && !hasNetflix',
    'isSkyPlus'
    ];

    let output = [];
    let podType = pod === 'top5' ? 'top' : 'spotlight';
    let spotlight_addons: Show[] = [];

    if (podType === 'spotlight') {
        // filter out and remove cinema/sport/kids - base it on channel name
        spotlight_addons = shows.filter(show => show.channel.includes('cinema') || show.channel.includes('sport') || show.channel.includes('kids'))

        spotlight_addons.forEach(show => {
            const ind = shows.indexOf(show)
            shows.splice(ind, 1)
        })
    }

    output.push(`var ${podType}_shows = ` + JSON.stringify(shows, null, 2));
    output.push(`var ${podType} = [];`);
    
    conditions.forEach((condition, index) => {
        output.push(`if (${condition}) {`);
        output.push('\t' + showOrders[index]?.comment);
        output.push(`\t${podType} = [${showOrders[index]?.order}];`);
        output.push('}');
    });

    if (podType === 'spotlight') {
        // add cinema/sport/kids here - logic is in the template already
        const cinema = spotlight_addons.filter(show => show.channel.includes('cinema'))[0]
        const sports = spotlight_addons.filter(show => show.channel.includes('sports'))[0]
        const kids = spotlight_addons.filter(show => show.channel.includes('kids'))[0]
        output.push('\n// Cinema / Sport / Kids options');
        output.push(`var spotlight_cinema = ` + JSON.stringify(cinema, null, 2));
        output.push(`var spotlight_sports = ` + JSON.stringify(sports, null, 2));
        output.push(`var spotlight_kids = ` + JSON.stringify(kids, null, 2));
    }

    return output.join('\n');
}

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
            <UTextarea v-model="inputShows" :rows="14" :ui="{ base: 'resize-none' }" placeholder="Add shows here" autofocus />
            <UTextarea v-model="inputOrders" :rows="14" :ui="{ base: 'resize-none' }" placeholder="Add content orders here" />
            <div class="col-span-full text-center">
                <UButton @click="convert">Turn this into something useful</UButton>
            </div>
        </div>
        <div v-else class="grid gap-4 grid-cols-2 h-full">
            <UTextarea v-model="outputLogic" :ui="{ base: 'resize-none h-full' }" />

            <div class="grid place-content-center gap-8">
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