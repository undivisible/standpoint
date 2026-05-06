<script lang="ts">
	import { currentUser } from '$lib/stores';
	import { hasProAccessStore } from '$lib';
	import { updateUserProfile, getUserProfile } from '$lib/user-profile';
	import { accentColor, setAccent } from '$lib/accent';
	import { createUserProfile } from '$lib';
	import type { UserProfile } from '$lib/user-profile';
	import { addToast } from '$lib/toast';
	import { uploadProfileImage } from '$lib/storage';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Toast from '../../components/toast.svelte';
	import LoadingIndicator from '../../components/loading-indicator.svelte';
	import UploadProgress from '../../components/upload-progress.svelte';
	import { currentTheme, themes, setThemeAccent } from '$lib/themes';

	// Preset accent swatches available per-theme
	const accentPresets = ['#FF6B35', '#FF356B', '#C0FF05', '#05FFAC', '#00FFFF', '#B400FF'];

	export let data: { userProfile: UserProfile | null };

	let userProfile = data.userProfile;
	let saving = false;
	let activeSection = 'profile';
	let hasInitialized = false;

	// Form state variables
	let profileForm = {
		uid: '',
		displayName: '',
		bio: '',
		avatarUrl: '',
		bannerUrl: '',
		location: '',
		website: '',
		twitter: '',
		instagram: ''
	};

	let notificationForm = {
		emailNotifications: false,
		pushNotifications: false,
		commentNotifications: false,
		likeNotifications: false,
		followNotifications: false
	};

	let privacyForm = {
		profileVisibility: 'public',
		tierlistVisibility: 'public',
		pollVisibility: 'public',
		showEmail: false,
		showLocation: false
	};

	let themeForm = {
		theme: 'light',
		colorScheme: 'default',
		fontSize: 'medium'
	};

	// Local hex values for custom accent pickers
	let primaryHex = '#ff6b35';
	let secondaryHex = '#ffb478';

	function hexToRgbString(hex: string) {
		if (!hex) return '255, 107, 53';
		const h = hex.replace('#', '');
		const bigint = parseInt(h, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		return `${r}, ${g}, ${b}`;
	}

	function rgbStringToHex(rgb: string) {
		const parts = rgb.split(',').map((p) => Number(p.trim()));
		if (parts.length < 3) return '#ff6b35';
		const [r, g, b] = parts;
		return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
	}

	let aiForm = {
		enableAI: false,
		aiSuggestions: false,
		aiImageGeneration: false
	};

	// File input references
	let avatarFileInput: HTMLInputElement;
	let bannerFileInput: HTMLInputElement;

	// Upload progress tracking
	let uploadProgress = 0;
	let isUploading = false;
	let uploadType = '';

	// File upload handlers
	async function handleAvatarUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && $currentUser) {
			try {
				isUploading = true;
				uploadType = 'avatar';
				uploadProgress = 0;

				const downloadURL = await uploadProfileImage(
					file,
					$currentUser.uid,
					'avatar',
					(progress) => {
						uploadProgress = progress;
					}
				);

				profileForm.avatarUrl = downloadURL;

				await updateUserProfile($currentUser.uid, {
					photoURL: downloadURL
				});

				// Update currentUser store to reflect the new avatar
				$currentUser = {
					...$currentUser,
					photoURL: downloadURL
				};

				addToast('Avatar uploaded successfully!', 'success');
			} catch (error) {
				console.error('Error uploading avatar:', error);
				addToast('Failed to upload avatar', 'error');
			} finally {
				isUploading = false;
			}
		}
	}

	async function handleBannerUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && $currentUser) {
			try {
				isUploading = true;
				uploadType = 'banner';
				uploadProgress = 0;

				const downloadURL = await uploadProfileImage(
					file,
					$currentUser.uid,
					'banner',
					(progress) => {
						uploadProgress = progress;
					}
				);

				profileForm.bannerUrl = downloadURL;

				await updateUserProfile($currentUser.uid, {
					bannerURL: downloadURL
				});

				addToast('Banner uploaded successfully!', 'success');
			} catch (error) {
				console.error('Error uploading banner:', error);
				addToast('Failed to upload banner', 'error');
			} finally {
				isUploading = false;
			}
		}
	}

	// Reactive statement to update form values when userProfile changes (only on initial load)
	$: if (userProfile && !hasInitialized) {
		profileForm = {
			uid: userProfile.uid || '',
			displayName: userProfile.displayName || '',
			bio: userProfile.bio || '',
			avatarUrl: userProfile.photoURL || '',
			bannerUrl: userProfile.bannerURL || '',
			location: userProfile.location || '',
			website: userProfile.website || '',
			twitter: userProfile.twitter || '',
			instagram: userProfile.instagram || ''
		};

		notificationForm = {
			emailNotifications: userProfile.emailNotifications ?? true,
			pushNotifications: userProfile.pushNotifications ?? true,
			commentNotifications: userProfile.commentNotifications ?? true,
			likeNotifications: userProfile.likeNotifications ?? true,
			followNotifications: userProfile.followNotifications ?? true
		};

		privacyForm = {
			profileVisibility: userProfile.profileVisibility || 'public',
			tierlistVisibility: userProfile.tierlistVisibility || 'public',
			pollVisibility: userProfile.pollVisibility || 'public',
			showEmail: userProfile.showEmail ?? false,
			showLocation: userProfile.showLocation ?? false
		};

		themeForm = {
			theme: userProfile.theme || 'light',
			colorScheme: userProfile.colorScheme || 'orange',
			fontSize: userProfile.fontSize || 'medium'
		};
		setAccent(themeForm.colorScheme);

		// initialize custom accent picker values from the selected theme
		const selected = themes.find((t) => t.id === themeForm.theme) || themes[0];
		primaryHex = rgbStringToHex(selected.colors.primary);
		secondaryHex = rgbStringToHex(selected.colors.secondary);

		aiForm = {
			enableAI: userProfile.enableAI ?? false,
			aiSuggestions: userProfile.aiSuggestions ?? false,
			aiImageGeneration: userProfile.aiImageGeneration ?? false
		};

		hasInitialized = true;
	}

	// Handle client-side auth check
	onMount(async () => {
		if (!$currentUser) {
			goto('/login?redirectTo=/settings');
			return;
		}

		// If we don't have profile data from SSR, load it client-side
		if (!userProfile) {
			try {
				userProfile = await getUserProfile($currentUser.uid);

				if (!userProfile) {
					await createUserProfile({
						uid: $currentUser.uid,
						displayName: $currentUser.displayName || '',
						email: $currentUser.email || '',
						photoURL: $currentUser.photoURL || ''
					});
					userProfile = await getUserProfile($currentUser.uid);
				}
			} catch (error) {
				console.error('Error loading profile:', error);
				addToast('Failed to load profile data', 'error');
			}
		}
	});

	// Save functions
	async function saveProfile() {
		if (!$currentUser || !userProfile) {
			addToast('User not authenticated', 'error');
			return;
		}

		try {
			saving = true;

			await updateUserProfile($currentUser.uid, {
				displayName: profileForm.displayName,
				bio: profileForm.bio,
				photoURL: profileForm.avatarUrl,
				bannerURL: profileForm.bannerUrl,
				location: profileForm.location,
				website: profileForm.website,
				twitter: profileForm.twitter,
				instagram: profileForm.instagram
			});

			// Update currentUser store to reflect changes
			if ($currentUser) {
				$currentUser = {
					...$currentUser,
					displayName: profileForm.displayName,
					photoURL: profileForm.avatarUrl
				};
			}

			// Update local state
			userProfile = {
				...userProfile,
				displayName: profileForm.displayName,
				bio: profileForm.bio,
				photoURL: profileForm.avatarUrl,
				bannerURL: profileForm.bannerUrl,
				location: profileForm.location,
				website: profileForm.website,
				twitter: profileForm.twitter,
				instagram: profileForm.instagram
			};

			addToast('Profile updated successfully', 'success');
		} catch (error) {
			console.error('Error updating profile:', error);
			addToast('Failed to update profile', 'error');
		} finally {
			saving = false;
		}
	}
	async function saveNotifications() {
		if (!$currentUser) return;

		try {
			saving = true;
			await updateUserProfile($currentUser.uid, {
				emailNotifications: notificationForm.emailNotifications,
				pushNotifications: notificationForm.pushNotifications,
				commentNotifications: notificationForm.commentNotifications,
				likeNotifications: notificationForm.likeNotifications,
				followNotifications: notificationForm.followNotifications
			});
			addToast('Notification settings updated!', 'success');
		} catch (error) {
			console.error('Error updating notifications:', error);
			addToast('Failed to update notifications', 'error');
		} finally {
			saving = false;
		}
	}

	async function savePrivacy() {
		if (!$currentUser) return;

		try {
			saving = true;
			await updateUserProfile($currentUser.uid, {
				profileVisibility: privacyForm.profileVisibility,
				tierlistVisibility: privacyForm.tierlistVisibility,
				pollVisibility: privacyForm.pollVisibility,
				showEmail: privacyForm.showEmail,
				showLocation: privacyForm.showLocation
			});
			addToast('Privacy settings updated!', 'success');
		} catch (error) {
			console.error('Error updating privacy:', error);
			addToast('Failed to update privacy settings', 'error');
		} finally {
			saving = false;
		}
	}

	async function saveTheme() {
		if (!$currentUser || !userProfile) {
			addToast('User not authenticated', 'error');
			return;
		}
		try {
			saving = true;
			setAccent(themeForm.colorScheme);
			await updateUserProfile($currentUser.uid, {
				theme: themeForm.theme,
				colorScheme: themeForm.colorScheme,
				fontSize: themeForm.fontSize
			});
			addToast('Theme settings updated!', 'success');
		} catch (error) {
			console.error('Error updating theme:', error);
			addToast('Failed to update theme', 'error');
		} finally {
			saving = false;
		}
	}

	async function saveAI() {
		if (!$currentUser || !userProfile) return;

		try {
			saving = true;
			await updateUserProfile($currentUser.uid, {
				enableAI: aiForm.enableAI,
				aiSuggestions: aiForm.aiSuggestions,
				aiImageGeneration: aiForm.aiImageGeneration
			});

			// Update local state
			userProfile = {
				...userProfile,
				enableAI: aiForm.enableAI,
				aiSuggestions: aiForm.aiSuggestions,
				aiImageGeneration: aiForm.aiImageGeneration
			};

			addToast('AI settings updated!', 'success');
		} catch (error) {
			console.error('Error updating AI settings:', error);
			addToast('Failed to update AI settings', 'error');
		} finally {
			saving = false;
		}
	}

	onMount(async () => {
		if (!$currentUser) {
			goto('/login?redirectTo=/settings');
			return;
		}

		// If we don't have profile data from SSR, load it client-side
		if (!userProfile) {
			try {
				userProfile = await getUserProfile($currentUser.uid);

				if (!userProfile) {
					await createUserProfile({
						uid: $currentUser.uid,
						displayName: $currentUser.displayName || '',
						email: $currentUser.email || '',
						photoURL: $currentUser.photoURL || ''
					});
					userProfile = await getUserProfile($currentUser.uid);
				}
			} catch (error) {
				console.error('Error loading profile:', error);
				addToast('Failed to load profile data', 'error');
			}
		}
	});
</script>

<svelte:head>
	<title>Settings - Standpoint</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="theme-transition min-h-screen" style="background-color: var(--bg); color: var(--text);">
	<div class="container mx-auto px-6 py-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-4xl font-bold">Settings</h1>
			<p class="text-gray-400">Manage your account preferences and privacy settings</p>
		</div>

		{#if isUploading}
			<UploadProgress progress={uploadProgress} message="Uploading {uploadType}..." />
		{/if}

		{#if !userProfile}
			<!-- Loading State -->
			<div class="flex items-center justify-center py-16">
				<LoadingIndicator size="lg" />
			</div>
		{:else}
			<!-- Sidebar Navigation -->
			<div class="flex gap-5">
				<div class="w-64 flex-shrink-0">
					<nav class="relative space-y-1 overflow-hidden p-1">
						<div
							class="absolute right-1 left-1 h-10 bg-[rgb(var(--primary))]/80 transition-all duration-400 ease-out"
							style="top:{(() => {
								const order = ['profile', 'notifications', 'privacy', 'theme', 'ai'];
								const idx = order.indexOf(activeSection);
								return 4 + idx * (40 + 4) + 'px';
							})()}"
						></div>
						{#each [{ id: 'profile', icon: 'person', label: 'Profile' }, { id: 'notifications', icon: 'notifications', label: 'Notifications' }, { id: 'privacy', icon: 'privacy_tip', label: 'Privacy' }, { id: 'theme', icon: 'palette', label: 'Theme' }, { id: 'ai', icon: 'smart_toy', label: 'AI Features' }] as item (item.id)}
							<button
								on:click={() => (activeSection = item.id)}
								class="relative z-10 flex h-10 w-full items-center px-4 text-left text-sm font-medium tracking-wide transition-colors {activeSection ===
								item.id
									? 'text-white'
									: 'text-gray-300 hover:text-white'}"
							>
								<span class="material-symbols-outlined mr-3 text-sm">{item.icon}</span>
								{item.label}

							</button>
						{/each}
					</nav>
				</div>

				<!-- Settings Content -->
				<div class="flex-1">
					<!-- Profile Settings -->
					{#if activeSection === 'profile'}
						<div class="border border-gray-700 bg-gray-800/50 p-8 backdrop-blur-sm">
							<h2 class="mb-6 text-2xl font-bold">Profile Information</h2>

							<div class="space-y-6">
								<!-- Profile Picture Section -->
								<div>
									<div class="mb-4 block text-sm font-medium text-gray-300">Profile Picture</div>
									<div class="flex items-center space-x-4">
										<img
											src={profileForm.avatarUrl ||
												userProfile?.photoURL ||
												`https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.displayName || 'User')}&size=200&background=ff5705&color=fff`}
											alt="Profile"
											class="h-16 w-16 border-2 border-gray-600"
										/>
										<div>
											<input
												type="file"
												bind:this={avatarFileInput}
												on:change={handleAvatarUpload}
												accept="image/*"
												class="hidden"
											/>
											<button
												type="button"
												on:click={() => avatarFileInput?.click()}
												class="bg-[rgb(var(--primary))] px-4 py-2 text-sm text-white transition-colors hover:brightness-110"
											>
												Upload New Picture
											</button>
											<p class="mt-1 text-xs text-gray-400">Upload a custom profile picture</p>
										</div>
									</div>
								</div>

								<!-- Banner Section -->
								<div>
									<div class="mb-4 block text-sm font-medium text-gray-300">
										Profile Banner
										<span
											class="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium text-white"
											style="background:linear-gradient(90deg,var(--pro-grad-stop-1),var(--pro-grad-stop-2),var(--pro-grad-stop-3));"
										>
											✨ PRO
										</span>
									</div>
									<div class="relative">
										<div class="mb-2 text-sm text-gray-400">Banner Preview:</div>
										{#if profileForm.bannerUrl}
											<div
												class="h-32 w-full border-2 border-gray-600 bg-cover bg-center"
												style="background-image: url({profileForm.bannerUrl})"
											></div>
										{:else if userProfile?.bannerURL}
											<div
												class="h-32 w-full border-2 border-gray-600 bg-cover bg-center"
												style="background-image: url({userProfile.bannerURL})"
											></div>
										{:else}
											<div
												class="flex h-32 w-full items-center justify-center border-2 border-gray-600 bg-[rgb(var(--primary))/25]"
											>
												<span class="text-opacity-70 text-white">No banner image set</span>
											</div>
										{/if}
										<div class="absolute inset-0 flex items-center justify-center">
											{#if $hasProAccessStore}
												<input
													type="file"
													bind:this={bannerFileInput}
													on:change={handleBannerUpload}
													accept="image/*"
													class="hidden"
												/>
												<button
													type="button"
													on:click={() => bannerFileInput?.click()}
													class="theme-transition px-4 py-2 text-sm transition-colors"
													style="background-color: rgba(0,0,0,0.5); color: var(--text);"
												>
													Change Banner
												</button>
											{:else}
												<button
													disabled
													class="theme-transition cursor-not-allowed px-4 py-2 text-sm"
													style="background-color: rgba(0,0,0,0.5); color: var(--text-secondary);"
												>
													Change Banner
												</button>
											{/if}
										</div>
									</div>
									{#if !$hasProAccessStore}
										<p class="text-accent/70 mt-2 text-xs">
											🔒 Pro feature: Unlock custom profile banners
										</p>
									{/if}
								</div>

								<div>
									<label for="displayName" class="mb-2 block text-sm font-medium text-gray-300">
										Display Name
									</label>
									<input
										id="displayName"
										type="text"
										bind:value={profileForm.displayName}
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
										placeholder="Your display name"
									/>
								</div>

								{#if $hasProAccessStore}
									<div>
										<label for="uid" class="mb-2 block text-sm font-medium text-gray-300">
											UID (Custom Username)
											<span
												class="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium text-white"
												style="background:linear-gradient(90deg,var(--pro-grad-stop-1),var(--pro-grad-stop-2),var(--pro-grad-stop-3));"
											>
												✨ PRO
											</span>
										</label>
										<input
											id="uid"
											type="text"
											bind:value={profileForm.uid}
											class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
											placeholder="Your custom UID"
											pattern="[a-zA-Z0-9_-]+"
											title="UID can only contain letters, numbers, hyphens, and underscores"
										/>
										<p class="mt-1 text-xs text-gray-400">
											Your custom UID will be used in your profile URL. Can only contain letters,
											numbers, hyphens, and underscores.
										</p>
									</div>
								{/if}

								<div>
									<label for="bio" class="mb-2 block text-sm font-medium text-gray-300">
										Bio
									</label>
									<textarea
										id="bio"
										bind:value={profileForm.bio}
										rows="3"
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
										placeholder="Tell us about yourself..."
									></textarea>
								</div>

								<div>
									<label for="location" class="mb-2 block text-sm font-medium text-gray-300">
										Location
									</label>
									<input
										id="location"
										type="text"
										bind:value={profileForm.location}
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
										placeholder="Your location"
									/>
								</div>

								<div>
									<label for="website" class="mb-2 block text-sm font-medium text-gray-300">
										Website
									</label>
									<input
										id="website"
										type="url"
										bind:value={profileForm.website}
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
										placeholder="https://your-website.com"
									/>
								</div>

								<div>
									<label for="twitter" class="mb-2 block text-sm font-medium text-gray-300">
										Twitter / X
									</label>
									<div class="relative">
										<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
											@
										</span>
										<input
											id="twitter"
											type="text"
											bind:value={profileForm.twitter}
											class="w-full border border-gray-600 bg-gray-700 px-4 py-3 pl-8 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
											placeholder="username"
										/>
									</div>
								</div>

								<div>
									<label for="instagram" class="mb-2 block text-sm font-medium text-gray-300">
										Instagram
									</label>
									<div class="relative">
										<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
											@
										</span>
										<input
											id="instagram"
											type="text"
											bind:value={profileForm.instagram}
											class="w-full border border-gray-600 bg-gray-700 px-4 py-3 pl-8 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
											placeholder="username"
										/>
									</div>
								</div>

								<button
									on:click={saveProfile}
									disabled={saving}
									class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:brightness-110 disabled:opacity-50"
								>
									{saving ? 'Saving...' : 'Save Profile'}
								</button>
							</div>
						</div>
					{/if}

					<!-- Notification Settings -->
					{#if activeSection === 'notifications'}
						<div class="border border-gray-700 bg-gray-800/50 p-8 backdrop-blur-sm">
							<h2 class="mb-6 text-2xl font-bold">Notification Preferences</h2>

							<div class="space-y-6">
								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Email Notifications</h3>
										<p class="text-sm text-gray-400">Receive notifications via email</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={notificationForm.emailNotifications}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Push Notifications</h3>
										<p class="text-sm text-gray-400">Receive push notifications in your browser</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={notificationForm.pushNotifications}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Comment Notifications</h3>
										<p class="text-sm text-gray-400">
											Get notified when someone comments on your posts
										</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={notificationForm.commentNotifications}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Like Notifications</h3>
										<p class="text-sm text-gray-400">
											Get notified when someone likes your content
										</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={notificationForm.likeNotifications}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Follow Notifications</h3>
										<p class="text-sm text-gray-400">Get notified when someone follows you</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={notificationForm.followNotifications}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<button
									on:click={saveNotifications}
									disabled={saving}
									class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:brightness-110 disabled:opacity-50"
								>
									{saving ? 'Saving...' : 'Save Notifications'}
								</button>
							</div>
						</div>
					{/if}

					<!-- Privacy Settings -->
					{#if activeSection === 'privacy'}
						<div class="border border-gray-700 bg-gray-800/50 p-8 backdrop-blur-sm">
							<h2 class="mb-6 text-2xl font-bold">Privacy Settings</h2>

							<div class="space-y-6">
								<div>
									<label
										for="profileVisibility"
										class="mb-2 block text-sm font-medium text-gray-300"
									>
										Profile Visibility
									</label>
									<select
										id="profileVisibility"
										bind:value={privacyForm.profileVisibility}
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
									>
										<option value="public">Public</option>
										<option value="friends">Friends Only</option>
										<option value="private">Private</option>
									</select>
								</div>

								<div>
									<label
										for="tierlistVisibility"
										class="mb-2 block text-sm font-medium text-gray-300"
									>
										Tierlist Visibility
									</label>
									<select
										id="tierlistVisibility"
										bind:value={privacyForm.tierlistVisibility}
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
									>
										<option value="public">Public</option>
										<option value="friends">Friends Only</option>
										<option value="private">Private</option>
									</select>
								</div>

								<div>
									<label for="pollVisibility" class="mb-2 block text-sm font-medium text-gray-300">
										Poll Visibility
									</label>
									<select
										id="pollVisibility"
										bind:value={privacyForm.pollVisibility}
										class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
									>
										<option value="public">Public</option>
										<option value="friends">Friends Only</option>
										<option value="private">Private</option>
									</select>
								</div>

								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Show Email</h3>
										<p class="text-sm text-gray-400">Display your email on your profile</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={privacyForm.showEmail}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-white">Show Location</h3>
										<p class="text-sm text-gray-400">Display your location on your profile</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={privacyForm.showLocation}
											class="peer sr-only"
										/>
										<div
											class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>

								<button
									on:click={savePrivacy}
									disabled={saving}
									class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:brightness-110 disabled:opacity-50"
								>
									{saving ? 'Saving...' : 'Save Privacy'}
								</button>
							</div>
						</div>
					{/if}

					<!-- Theme Settings -->
					{#if activeSection === 'theme'}
						<div class="border border-gray-700 bg-gray-800/50 p-8 backdrop-blur-sm">
							<h2 class="mb-6 text-2xl font-bold">Theme & Appearance</h2>
							<div class="space-y-6">
								<div>
									<label for="theme" class="mb-3 block text-sm font-medium text-gray-300">
										Theme Style
									</label>
									<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
										{#each themes as theme (theme.id)}
											<button
												type="button"
												on:click={() => {
													themeForm.theme = theme.id;
													currentTheme.setTheme(theme.id);
												}}
												class="group relative overflow-hidden border-2 p-4 text-left transition-all hover:scale-105 {themeForm.theme ===
												theme.id
													? 'border-[rgb(var(--primary))] shadow-lg shadow-[rgb(var(--primary))]/30'
													: 'border-gray-600 hover:border-gray-500'}"
												style="background: {theme.colors.surface};"
											>
												<div class="mb-2 flex items-center justify-between">
													<span class="text-sm font-bold" style="color: {theme.colors.text};">
														{theme.name}
													</span>
													{#if themeForm.theme === theme.id}
														<span
															class="material-symbols-outlined text-sm"
															style="color: rgb(var(--primary));">check_circle</span
														>
													{/if}
												</div>
												<p
													class="mb-3 text-xs opacity-70"
													style="color: {theme.colors.textSecondary};"
												>
													{theme.description}
												</p>
												<div class="flex gap-1">
													<div
														class="h-6 w-6 border border-gray-500"
														style="background: rgb({theme.colors.primary});"
													></div>
													<div
														class="h-6 w-6 border border-gray-500"
														style="background: {theme.colors.background};"
													></div>
													<div
														class="h-6 w-6 border border-gray-500"
														style="background: {theme.colors.surface};"
													></div>
												</div>
											</button>
										{/each}
									</div>
								</div>

								<div>
									<label for="colorScheme" class="mb-2 block text-sm font-medium text-gray-300">
										Accent (pick or use custom)
									</label>
									<div class="mb-3 flex items-center gap-2">
										{#each accentPresets as preset (preset)}
											<button
												type="button"
												class="h-8 w-8 transform rounded-full border-2 transition-transform hover:scale-110"
												style="background: {preset}; border-color: rgba(255,255,255,0.12);"
												aria-label="Select accent {preset}"
												on:click={() => {
													// apply per-theme accent (store as rgb)
													const rgb = hexToRgbString(preset);
													setThemeAccent(themeForm.theme, rgb, rgb);
													primaryHex = preset;
												}}
											></button>
										{/each}
									</div>
								</div>

								<!-- Custom accent pickers -->
								<div>
									<div class="mb-2 block text-sm font-medium text-gray-300">Custom Accent</div>
									<div class="flex items-center gap-4">
										<div class="flex items-center gap-2">
											<label for="primaryAccent" class="text-sm text-gray-300">Primary</label>
											<input
												id="primaryAccent"
												type="color"
												bind:value={primaryHex}
												on:input={() => {
													const rgb = hexToRgbString(primaryHex);
													setThemeAccent(themeForm.theme, rgb, hexToRgbString(secondaryHex));
													addToast('Primary accent applied', 'success');
												}}
											/>
										</div>
										<div class="flex items-center gap-2">
											<label for="secondaryAccent" class="text-sm text-gray-300">Secondary</label>
											<input
												id="secondaryAccent"
												type="color"
												bind:value={secondaryHex}
												on:input={() => {
													const rgb = hexToRgbString(secondaryHex);
													setThemeAccent(themeForm.theme, hexToRgbString(primaryHex), rgb);
													addToast('Secondary accent applied', 'success');
												}}
											/>
										</div>
									</div>
								</div>

								<!--<div>
										<label for="fontSize" class="mb-2 block text-sm font-medium text-gray-300">
											Font Size
										</label>
										<select
											id="fontSize"
											bind:value={themeForm.fontSize}
											class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-[rgb(var(--primary))]"
										>
											<option value="small">Small</option>
											<option value="medium">Medium</option>
											<option value="large">Large</option>
										</select>
									</div>

									<button
										on:click={saveTheme}
										disabled={saving}
										class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:brightness-110 disabled:opacity-50"
									>
										{saving ? 'Saving...' : 'Save Theme'}
									</button>-->
							</div>
						</div>
					{/if}

					<!-- AI Settings -->
					{#if activeSection === 'ai'}
						<div class="border border-gray-700 bg-gray-800/50 p-8 backdrop-blur-sm">
							<h2 class="mb-6 text-2xl font-bold">AI Features</h2>

							{#if $hasProAccessStore}
								<div class="space-y-6">
									<div class="flex items-center justify-between">
										<div>
											<h3 class="font-medium text-white">Enable AI Features</h3>
											<p class="text-sm text-gray-400">Allow AI to enhance your experience</p>
										</div>
										<label class="relative inline-flex cursor-pointer items-center">
											<input type="checkbox" bind:checked={aiForm.enableAI} class="peer sr-only" />
											<div
												class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
											></div>
										</label>
									</div>

									<div class="flex items-center justify-between">
										<div>
											<h3 class="font-medium text-white">AI Suggestions</h3>
											<p class="text-sm text-gray-400">Get intelligent content suggestions</p>
										</div>
										<label class="relative inline-flex cursor-pointer items-center">
											<input
												type="checkbox"
												bind:checked={aiForm.aiSuggestions}
												class="peer sr-only"
											/>
											<div
												class="peer h-6 w-11 bg-gray-700 peer-checked:bg-[rgb(var(--primary))] peer-focus:ring-4 peer-focus:ring-[rgb(var(--primary))]/40 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
											></div>
										</label>
									</div>

									<div class="flex items-center justify-between">
										<div>
											<h3 class="font-medium text-white">More AI features on the way</h3>
											<p class="text-sm text-gray-400">Unless I forget</p>
										</div>
									</div>

									<button
										on:click={saveAI}
										disabled={saving}
										class="bg-[rgb(var(--primary))] px-6 py-3 text-white transition-colors hover:brightness-110 disabled:opacity-50"
									>
										{saving ? 'Saving...' : 'Save AI Settings'}
									</button>
								</div>
							{:else}
								<div class="py-12 text-center">
									<div class="mb-4">
										<span class="text-6xl">🤖</span>
									</div>
									<h3 class="mb-2 text-xl font-bold text-white">Pro Feature</h3>
									<p class="mb-6 text-gray-400">Unlock AI-powered features with Standpoint Pro</p>
									<a
										href="/pro"
										class="inline-flex items-center px-6 py-3 font-medium text-white transition-all"
										style="background:linear-gradient(90deg,var(--pro-grad-stop-1),var(--pro-grad-stop-2),var(--pro-grad-stop-3));"
									>
										<span>✨</span>
										<span class="ml-2">Upgrade to Pro</span>
									</a>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<Toast />
