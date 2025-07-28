import { ApiService } from './services/api';
import { StorageService } from './services/storage';
import { AuthToken, User } from './types';

class PopupManager {
  private apiService: ApiService;
  private storageService: StorageService;
  private currentUser: User | null = null;

  constructor() {
    this.apiService = ApiService.getInstance();
    this.storageService = StorageService.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.checkAuthStatus();
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showError('Failed to initialize extension');
    }
  }

  private async checkAuthStatus(): Promise<void> {
    const token = await this.storageService.getAuthToken();
    
    if (token) {
      this.apiService.setAuthToken(token);
      const user = await this.storageService.getUserData();
      
      if (user) {
        this.currentUser = user;
        this.showDashboard();
      } else {
        // Token exists but no user data, try to fetch user
        const response = await this.apiService.getCurrentUser();
        if (response.success && response.data) {
          this.currentUser = response.data;
          await this.storageService.setUserData(response.data);
          this.showDashboard();
        } else {
          // Invalid token, clear it
          await this.storageService.clearAuthToken();
          this.showLogin();
        }
      }
    } else {
      this.showLogin();
    }
  }

  private setupEventListeners(): void {
    // Login form
    const loginForm = document.getElementById('loginForm') as HTMLFormElement;
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Signup form
    const signupForm = document.getElementById('signupForm') as HTMLFormElement;
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    }

    // Navigation links
    const showSignupLink = document.getElementById('showSignup');
    if (showSignupLink) {
      showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSignup();
      });
    }

    const showLoginLink = document.getElementById('showLogin');
    if (showLoginLink) {
      showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showLogin();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.initialize());
    }
  }

  private async handleLogin(e: Event): Promise<void> {
    e.preventDefault();
    
    const username = (document.getElementById('loginUsername') as HTMLInputElement).value;
    const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
    
    if (!username || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.showLoading();
    
    try {
      const response = await this.apiService.login(username, password);
      
      if (response.success && response.data) {
        const { token, user } = response.data;
        
        // Store token and user data
        await this.storageService.setAuthToken(token);
        await this.storageService.setUserData(user);
        
        this.apiService.setAuthToken(token);
        this.currentUser = user;
        
        this.showDashboard();
      } else {
        this.showError(response.error || 'Login failed');
        this.showLogin();
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('An error occurred during login');
      this.showLogin();
    }
  }

  private async handleSignup(e: Event): Promise<void> {
    e.preventDefault();
    
    const name = (document.getElementById('signupName') as HTMLInputElement).value;
    const username = (document.getElementById('signupUsername') as HTMLInputElement).value;
    const email = (document.getElementById('signupEmail') as HTMLInputElement).value;
    const password = (document.getElementById('signupPassword') as HTMLInputElement).value;
    
    if (!name || !username || !email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.showLoading();
    
    try {
      const response = await this.apiService.signup(username, email, password, name);
      
      if (response.success && response.data) {
        const { token, user } = response.data;
        
        // Store token and user data
        await this.storageService.setAuthToken(token);
        await this.storageService.setUserData(user);
        
        this.apiService.setAuthToken(token);
        this.currentUser = user;
        
        this.showDashboard();
      } else {
        this.showError(response.error || 'Signup failed');
        this.showSignup();
      }
    } catch (error) {
      console.error('Signup error:', error);
      this.showError('An error occurred during signup');
      this.showSignup();
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await this.apiService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    }
    
    // Clear local data regardless of API response
    await this.storageService.clearAuthToken();
    await this.storageService.clearUserData();
    this.apiService.clearAuthToken();
    this.currentUser = null;
    
    this.showLogin();
  }

  private showScreen(screenId: string): void {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.add('hidden'));
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.remove('hidden');
    }
  }

  private showLoading(): void {
    this.showScreen('loading');
  }

  private showLogin(): void {
    this.showScreen('login');
    // Clear form fields
    const loginForm = document.getElementById('loginForm') as HTMLFormElement;
    if (loginForm) {
      loginForm.reset();
    }
  }

  private showSignup(): void {
    this.showScreen('signup');
    // Clear form fields
    const signupForm = document.getElementById('signupForm') as HTMLFormElement;
    if (signupForm) {
      signupForm.reset();
    }
  }

  private showDashboard(): void {
    this.showScreen('dashboard');
    
    // Update user name
    const userNameElement = document.getElementById('userName');
    if (userNameElement && this.currentUser) {
      userNameElement.textContent = this.currentUser.name;
    }
  }

  private showError(message: string): void {
    this.showScreen('error');
    const errorMessageElement = document.getElementById('errorMessage');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
}); 