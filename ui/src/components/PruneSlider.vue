<template><div><input class="form-range" type="range" :min="minValue" :max="maxValue" :value="startingValue" :disabled="disabled" aria-label="CPU target percentage" @input="$emit('change', Number($event.target.value))"><output>{{ startingValue }}%</output></div></template>
<script>
export default {props: {minValue: Number, maxValue: Number, startingValue: Number, disabled: Boolean}, emits: ['change']};
</script>
