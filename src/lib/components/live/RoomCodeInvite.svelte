<script lang="ts">
	export let code = '';

	let copied = false;

	async function copyCode() {
		await navigator.clipboard?.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}
</script>

<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] p-5">
	<p class="text-xs tracking-[0.24em] text-[var(--text-secondary)] uppercase">Room code</p>
	<div class="mt-3 flex items-center justify-between gap-4">
		<div class="font-sans text-4xl font-black tracking-[0.18em] text-[var(--text)]">{code}</div>
		<button
			type="button"
			class="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition hover:border-[rgb(var(--primary))] hover:text-[rgb(var(--primary))]"
			onclick={copyCode}
		>
			{copied ? 'Copied' : 'Copy'}
		</button>
	</div>
	<div
		class="mt-4 flex aspect-square max-h-28 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)]"
	>
		standpoint.undivisible.dev/spectrum/{code}
	</div>
</div>
