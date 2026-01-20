
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeminiService } from './services/gemini.service.ts';
import { VideoGroup, VideoVariant } from './models/video-info.model.ts';

type SortByType = 'popularity' | 'date' | 'title';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule],
})
export class AppComponent implements OnInit {
  private readonly geminiService = inject(GeminiService);
  private readonly storageKey = 'video-finder-history';

  url = signal<string>('');
  videoGroups = signal<VideoGroup[]>([]);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  hasSearched = signal<boolean>(false);

  // Modal State
  isModalOpen = signal<boolean>(false);
  selectedVideoGroup = signal<VideoGroup | null>(null);
  copiedUrl = signal<string>('');

  // Filtering, sorting, and history
  urlHistory = signal<string[]>([]);
  selectedCategory = signal<string>('all');
  sortBy = signal<SortByType>('popularity');

  allCategories = computed(() => {
    const categories = this.videoGroups().map(v => v.category).filter((c): c is string => !!c);
    return ['all', ...Array.from(new Set(categories))];
  });
  
  filteredVideoGroups = computed(() => {
    const groups = this.videoGroups();
    const category = this.selectedCategory();
    const sort = this.sortBy();

    let result = [...groups];

    // Filter
    if (category !== 'all') {
      result = result.filter(v => v.category === category);
    }

    // Sort
    return result.sort((a, b) => {
      switch (sort) {
        case 'date':
          return new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime();
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  async findVideos(): Promise<void> {
    const urlToSearch = this.url();
    if (!this.isValidUrl(urlToSearch)) {
      this.error.set('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.videoGroups.set([]);
    this.hasSearched.set(true);
    this.selectedCategory.set('all');

    try {
      const foundGroups = await this.geminiService.findVideosInUrl(urlToSearch);
      this.videoGroups.set(foundGroups);
      this.updateHistory(urlToSearch);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }
  
  loadFromHistory(url: string): void {
    this.url.set(url);
    this.findVideos();
  }

  onUrlChange(newUrl: string): void {
    this.url.set(newUrl);
    if (this.error()) {
        this.error.set(null);
    }
  }
  
  isValidUrl(urlString: string): boolean {
    try {
      const newUrl = new URL(urlString);
      return newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  getDownloadFilename(title: string, variant: VideoVariant): string {
    const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const resolution = variant.resolution?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'video';
    return `${cleanTitle}_${resolution}.${variant.format}`;
  }
  
  openDownloadModal(group: VideoGroup): void {
    this.selectedVideoGroup.set(group);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedVideoGroup.set(null);
    this.copiedUrl.set('');
  }
  
  copyToClipboard(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.copiedUrl.set(url);
      setTimeout(() => {
        if (this.copiedUrl() === url) {
          this.copiedUrl.set('');
        }
      }, 2000);
    });
  }

  setCategoryFilter(category: string): void {
    this.selectedCategory.set(category);
  }

  setSortBy(criteria: SortByType): void {
    this.sortBy.set(criteria);
  }

  private loadHistory(): void {
    try {
      const historyJson = localStorage.getItem(this.storageKey);
      if (historyJson) {
        this.urlHistory.set(JSON.parse(historyJson));
      }
    } catch (e) {
      console.error("Failed to load history from localStorage", e);
    }
  }

  private updateHistory(url: string): void {
    this.urlHistory.update(history => {
      const newHistory = [url, ...history.filter(h => h !== url)];
      const limitedHistory = newHistory.slice(0, 10); 
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(limitedHistory));
      } catch (e) {
        console.error("Failed to save history to localStorage", e);
      }
      return limitedHistory;
    });
  }

  clearHistory(): void {
    this.urlHistory.set([]);
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.error("Failed to clear history from localStorage", e);
    }
  }
}
