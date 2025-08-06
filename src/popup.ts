import { ApiService } from './services/api';
import { ErrorHandler } from './services/errorHandler';
import { StorageService } from './services/storage';
import { User } from './types';

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
      const errorMessage = ErrorHandler.getErrorMessage(error, 'initialization');
      this.showError(errorMessage);
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
        try {
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
        } catch (error) {
          // If we can't connect to server, show error instead of login
          const errorMessage = ErrorHandler.getErrorMessage(error, 'token validation');
          this.showError(errorMessage);
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

    const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
    const password = (document.getElementById('loginPassword') as HTMLInputElement).value;

    if (!email || !password) {
      this.showLoginError('Please fill in all fields');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showLoginError('Please enter a valid email address');
      return;
    }

    this.showLoading();

    try {
      const response = await this.apiService.login(email, password);

      if (response.success && response.data) {
        const { token, user } = response.data;

        // Store token and user data
        await this.storageService.setAuthToken(token);
        await this.storageService.setUserData(user);

        this.apiService.setAuthToken(token);
        this.currentUser = user;

        this.showDashboard();
      } else {
        // Handle specific error messages - go back to login screen
        this.showLogin();
        const errorMessage = ErrorHandler.getErrorMessage(response.error, 'login');
        this.showLoginError(errorMessage);
      }
    } catch (error) {
      // Go back to login screen and show error
      this.showLogin();
      const errorMessage = ErrorHandler.getErrorMessage(error, 'login');
      this.showLoginError(errorMessage);
    }
  }

  private async handleSignup(e: Event): Promise<void> {
    e.preventDefault();

    const email = (document.getElementById('signupEmail') as HTMLInputElement).value;
    const password = (document.getElementById('signupPassword') as HTMLInputElement).value;
    const confirmPassword = (document.getElementById('signupConfirmPassword') as HTMLInputElement).value;

    if (!email || !password || !confirmPassword) {
      this.showSignupError('Please fill in all fields');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showSignupError('Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      this.showSignupError('Passwords do not match');
      return;
    }

    this.showLoading();

    try {
      const response = await this.apiService.signup(email, password);

      if (response.success && response.data) {
        const { token, user } = response.data;

        // Store token and user data
        await this.storageService.setAuthToken(token);
        await this.storageService.setUserData(user);

        this.apiService.setAuthToken(token);
        this.currentUser = user;

        this.showDashboard();
      } else {
        // Handle specific error messages - go back to signup screen
        this.showSignup();
        const errorMessage = ErrorHandler.getErrorMessage(response.error, 'signup');
        this.showSignupError(errorMessage);
      }
    } catch (error) {
      // Go back to signup screen and show error
      this.showSignup();
      const errorMessage = ErrorHandler.getErrorMessage(error, 'signup');
      this.showSignupError(errorMessage);
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await this.apiService.logout();
    } catch (error) {
      // Continue with logout even if API call fails
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
    this.clearLoginError();
  }

  private showSignup(): void {
    this.showScreen('signup');
    // Clear form fields
    const signupForm = document.getElementById('signupForm') as HTMLFormElement;
    if (signupForm) {
      signupForm.reset();
    }
    this.clearSignupError();
  }

  private showDashboard(): void {
    this.showScreen('dashboard');
  }

  private showError(message: string): void {
    this.showScreen('error');
    const errorMessageElement = document.getElementById('errorMessage');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
    }
  }

  private showSignupError(message: string): void {
    const errorElement = document.getElementById('signupError');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  private showLoginError(message: string): void {
    const errorElement = document.getElementById('loginError');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  private clearSignupError(): void {
    const errorElement = document.getElementById('signupError');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
    }
  }

  private clearLoginError(): void {
    const errorElement = document.getElementById('loginError');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});