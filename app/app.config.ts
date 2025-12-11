export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate'
    },
    button: {
      slots: {
        base: "rounded px-4 py-2 text-center uppercase leading-8 border-none cursor-pointer justify-center disabled:[--tw-bg-opacity:0.8] font-normal"
      },
      variants: {
        size: {
          xxl: "text-lg"
        }
      },
      defaultVariants: {
        size: "xxl"
      }
    },
    formField: {
      slots: {
        label: "block mt-2 text-neutral-700 dark:text-neutral-200"
      }
    }
  }
})