import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../ui/GlassCard";
import { ProfileHeader } from "./ProfileHeader";
import { IdentityFields } from "./IdentityFields";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { FooterActions } from "../ui/FooterActions";
import { isValidName, isValidEmail, isValidPassword } from "../../utils/validation";
import { resolveMediaUrl, uploadProfileImageApi, changePasswordApi, updateUserApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { getErrorMessage } from "../../utils/error";
import { handleGetHelp } from "../../utils/help";
import { RiArrowGoBackLine } from "react-icons/ri";
import { MdOutlineMail } from "react-icons/md";


// Componente principale della pagina Impostazioni Profilo.
// La prop isAdmin (opzionale, default false) serve per nascondere il bottone "Get Help" agli amministratori.
export function ProfileSettingsSection({ isAdmin = false }: { isAdmin?: boolean }) {
    // useNavigate ci permette di mandare l'utente ad altre pagine tramite codice.
    const navigate = useNavigate();

    // useAuth ci fornisce i dati dell'utente attualmente loggato (user)
    // e una funzione (refreshUser) per forzare il sistema a riscaricare questi dati dal server.
    const { user, refreshUser } = useAuth();

    // ==========================================
    // 1. GESTIONE DELLO STATO (Campi del Form)
    // ==========================================

    // Variabili che contengono quello che l'utente sta digitando in questo momento nei campi di testo.
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [email, setEmail] = useState("");

    // Questa è una "fotografia" dei dati originari presi dal database quando si apre la pagina.
    // La usiamo per capire se l'utente ha effettuato delle modifiche rispetto al salvataggio originario.
    const [initialData, setInitialData] = useState({ name: "", surname: "", email: "" });

    // Campi per la gestione della password e per l'eventuale messaggio di errore (es: vecchia password sbagliata).
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");

    // ==========================================
    // 2. GESTIONE DELLO STATO (Intestazione & Immagine)
    // ==========================================

    // avatarUrl è il link all'immagine da mostrare nel cerchio (può essere l'url del server o un'anteprima locale).
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    // Qua ci salviamo il vero e proprio "File" estratto dal computer se l'utente cambia foto.
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    // isUploading attiva l'animazione di caricamento (spinner) sul cerchio della foto.
    const [isUploading, setIsUploading] = useState(false);

    // Salva l'ID dell'utente (serve per le chiamate API per aggiornarne poi i dati).
    const [userId, setUserId] = useState<number | null>(null);
    // isSaving diventa true quando premiamo "Save Changes", bloccando il bottone per evitare doppi clic.
    const [isSaving, setIsSaving] = useState(false);

    // ==========================================
    // 3. PRIMO AVVIO (Precaricamento Dati)
    // ==========================================

    // Questo 'useEffect' scatta ogni volta che la variabile 'user' (presa da useAuth) cambia o appare.
    useEffect(() => {
        // Se c'è un utente loggato...
        if (user) {
            // ...salviamo il suo ID
            setUserId(user.userId);
            // ...inizializziamo i campi di input del form con i suoi dati veri
            setName(user.firstName || "");
            setSurname(user.lastName || "");
            setEmail(user.email || "");
            // ...e scattiamo la famosa "fotografia" dei dati originari.
            setInitialData({
                name: user.firstName || "",
                surname: user.lastName || "",
                email: user.email || ""
            });
            // Infine, se l'utente ha già una foto salvata nel database, mostriamola generandone l'URL.
            if (user.profileImg) {
                setAvatarUrl(resolveMediaUrl(user.profileImg));
            }
        }
    }, [user]); // L'array col "user" dice a React "rifai tutto questo solo se user cambia".


    // ==========================================
    // 4. LOGICA DI VALIDAZIONE
    // ==========================================

    // Controlla se almeno un campo d'identità (nome, cognome, mail) è DIVERSO dalla fotografia iniziale.
    // L'operatore || significa "OPPURE".
    const hasIdentityChanged =
        name !== initialData.name ||
        surname !== initialData.surname ||
        email !== initialData.email;

    // Controlla se l'utente sta provando a cambiare password (ha scritto qualcosa in uno dei due campi).
    const hasPasswordInput = currentPassword.length > 0 || newPassword.length > 0;

    // Controlla se l'utente ha inserito una nuova foto dal proprio PC.
    const hasImageChanged = selectedImageFile !== null;

    // Controlla che i campi d'identità inseriti siano sani (non vuoti, niente numeri nel nome, email col @, ecc.)
    // L'operatore && significa "E ALLO STESSO TEMPO".
    const isIdentityValid = isValidName(name) && isValidName(surname) && isValidEmail(email);

    // La password è valida a due condizioni:
    // A. Oppure non sta provando a cambiarla (!hasPasswordInput è vero)
    // B. Oppure l'ha impostata compilando il form corrente ED ha una nuova password valida (es. lunga abbastanza).
    const isPasswordValid = !hasPasswordInput || (currentPassword.length > 0 && isValidPassword(newPassword));

    // VERDETTO FINALE: Il bottone Save si accende solo se:
    // 1. Ho fatto delle modifiche (identità o password o foto) E
    // 2. L'identità (comunque io l'abbia scritta) è valida E
    // 3. La password è valida (o non l'ho proprio toccata).
    const isSaveEnabled = (hasIdentityChanged || hasPasswordInput || hasImageChanged) && isIdentityValid && isPasswordValid;

    // ==========================================
    // 5. CALLBACK DEI PULSANTI MINORI
    // ==========================================

    // Quando clicca "Forgot Password" nel form del cambio password, vai alla pagina di recupero
    const handleRetrievePassword = useCallback(() => {
        navigate("/forgot-password");
    }, [navigate]);

    // Quando clicca "Exit" nel footer, vai alla pagina prcedente nella history del browser
    const handleExit = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    // Quando seleziona una nuova foto dal computer...
    const handleImageSelect = useCallback((file: File) => {
        // ...salva il file in stato (così poi nel salvataggio vero lo mandiamo al server)
        setSelectedImageFile(file);
        // ...e genera istantaneamente un link fittizio provvisorio per mostrare subito l'anteprima a video
        setAvatarUrl(URL.createObjectURL(file));
    }, []);

    // ==========================================
    // 6. LOGICA DI SALVATAGGIO
    // ==========================================

    // Questa funzione viene scatenata cliccando su "Save Changes".
    const handleSave = useCallback(async () => {
        // Blocco di sicurezza: mi fermo subito se non ho l'ID, se sto già salvando, o se i dati non sono validi.
        if (!userId || isSaving || !isSaveEnabled) return;

        // Blocca l'interfaccia mettendo il caricamento al bottone.
        setIsSaving(true);
        // Pulisce vecchi errori altrimenti rimangono rossi a schermo.
        setPasswordError("");

        try {
            // STEP A: Salvataggio Nuova Foto (se c'è)
            if (selectedImageFile) {
                setIsUploading(true); // Gira la rotellina sull'avatar
                // Invia la foto al server tramite le API
                const updatedUser = await uploadProfileImageApi(selectedImageFile);
                if (updatedUser.profileImg) {
                    setAvatarUrl(resolveMediaUrl(updatedUser.profileImg));
                }
                // Resettiamo il file a null (l'abbiamo già caricato, non lo si ricarica più).
                setSelectedImageFile(null);
                setIsUploading(false); // Ferma rotellina avatar
            }

            // STEP B: Salvataggio Dati Identità (nome, cognome, mail - solo se cambiati)
            if (hasIdentityChanged) {
                // Manda i dati puliti (trim() rimuove spazi vuoti iniziali o finali)
                const updated = await updateUserApi(userId, {
                    firstName: name.trim(),
                    lastName: surname.trim(),
                    email: email.trim(),
                });

                // Aggiorniamo i campi di input per certezza con quello che il server ci ha risposto
                setName(updated.firstName || "");
                setSurname(updated.lastName || "");
                setEmail(updated.email || "");

                // Mettiamo i nuovi dati appena salvati come nostra nuova "fotografia base".
                // Così hasIdentityChanged diventerà falso, e il pulsante si spegnerà di nuovo.
                setInitialData({
                    name: updated.firstName || "",
                    surname: updated.lastName || "",
                    email: updated.email || "",
                });
            }

            // STEP C: Salvataggio Cambio Password (solo se ha compilato i campi password)
            if (hasPasswordInput) {
                try {
                    // Manda vecchia e nuova password all'API.
                    await changePasswordApi(userId, currentPassword, newPassword);
                    // Se la chiamata non fallisce (es. vecchia pass era buona), svuotiamo i campi a video.
                    setCurrentPassword("");
                    setNewPassword("");
                } catch (pwdErr) {
                    // Se l'API ritorna errore (vecchia password errata), si blocca qua.
                    // Catturiamo l'errore e lo passiamo a passwordError per mostrarlo rosso all'utente.
                    setPasswordError(getErrorMessage(pwdErr, "Failed to change password. Please check your current password."));
                }
            }
        } catch (err) {
            // Catch globale: se scoppia il server durante foto o dati base, logga l'errore e stacca i finti caricamenti.
            console.error("Failed to save settings", err);
            setIsUploading(false);
        } finally {
            // FINALLY viene eseguito in ogni caso, sia che try sia andato bene, sia se è andato nel catch.

            // IMPORTANTE: Ricarica dal server i dati globali dell'utente loggato.
            // Serve perché se ho cambiato foto o nome nel profilo, voglio che si aggiornino SIMULTANEAMENTE
            // anche nella barra di navigazione globale fissa in alto.
            await refreshUser();

            // Sblocca il pulsante save
            setIsSaving(false);
        }
    }, [
        // L'array delle dipendenze del useCallback. Tutte le variabili "esterne" 
        // usate qua dentro vanno dichiarate per fare in modo che la funzione usi sempre l'ultimo valore disponibile.
        userId, isSaving, isSaveEnabled, selectedImageFile,
        hasIdentityChanged, name, surname, email,
        hasPasswordInput, currentPassword, newPassword, refreshUser
    ]);

    // ==========================================
    // 7. RENDERIZZA L'INTERFACCIA (Costruisce visivamente i pezzi a schermo)
    // ==========================================
    return (
        <GlassCard className="w-full">

            {/* Blocco 1: L'intestazione col titolo e la foto da gestire */}
            <ProfileHeader
                avatarUrl={avatarUrl}
                title="Profile Settings"
                subtitle="Update your identity and security preferences"
                onImageSelect={handleImageSelect}
                isUploading={isUploading}
            />

            {/* Blocco 2: I campi del form dell'identità (si legano allo State) */}
            <IdentityFields
                name={name}
                onChangeName={setName} // Quando scrivi nel campo name, si chiama setName che aggiorna la variabile
                surname={surname}
                onChangeSurname={setSurname}
                email={email}
                onChangeEmail={setEmail}
            />

            {/* Blocco 3: I campi del cambio password e relative logiche di errore */}
            <ChangePasswordSection
                requireCurrentPassword={true}
                currentPassword={currentPassword}
                onChangeCurrentPassword={(val) => {
                    setCurrentPassword(val);
                    // Pulisco l'errore rosso l'istante in cui l'utente riprende a scrivere una nuova lettera
                    if (passwordError) setPasswordError("");
                }}
                newPassword={newPassword}
                onChangeNewPassword={(val) => {
                    setNewPassword(val);
                    if (passwordError) setPasswordError("");
                }}
                onRetrievePassword={handleRetrievePassword}
                error={passwordError}
            />

            {/* Blocco 4: I bottoni in fondo alla pagina */}
            <FooterActions
                // Se è salvabile e non sta già salvando, lo abilita.
                isSaveEnabled={isSaveEnabled && !isSaving}
                onSave={handleSave} // Passa la mega funzione di salvataggio
                isSaving={isSaving} // Dà informazioni al bottone se deve far girare l'animazione al suo interno
                links={[
                    // Tasto Exit fisso per tutti
                    { label: "Exit", icon: <RiArrowGoBackLine size={16} />, onClick: handleExit },
                    // Tasto Help aggiunto con uno spread condizionale: Solo se NON sei Admin
                    ...(!isAdmin ? [{ label: "Get Help", icon: <MdOutlineMail size={16} />, onClick: handleGetHelp }] : []),
                ]}
            />

        </GlassCard>
    );
}
