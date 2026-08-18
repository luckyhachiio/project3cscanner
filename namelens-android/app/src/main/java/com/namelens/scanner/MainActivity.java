package com.namelens.scanner;

import android.Manifest;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.*;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends AppCompatActivity {
  static final int CAM=10;
  PreviewView preview; TextView result, raw, bubble, letter, status, count; Button save, snap, edit, listBtn;
  final ArrayList<Rec> recs=new ArrayList<>(); final ExecutorService exec=Executors.newSingleThreadExecutor();
  final TextRecognizer ocr= TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
  boolean busy=false, locked=false, autoLetter=true; char current='A'; Cand cand=new Cand(); long lastRun=0;

  @Override public void onCreate(Bundle b){super.onCreate(b); load(); build(); if(hasCam()) startCamera(); else request();}
  boolean hasCam(){return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED;}
  void request(){ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.CAMERA},CAM); status.setText("Camera permission required");}
  @Override public void onRequestPermissionsResult(int r,@NonNull String[] p,@NonNull int[] g){super.onRequestPermissionsResult(r,p,g); if(r==CAM&&g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)startCamera(); else status.setText("Camera permission denied");}

  void build(){
    FrameLayout root=new FrameLayout(this); root.setBackgroundColor(Color.BLACK);
    preview=new PreviewView(this); preview.setScaleType(PreviewView.ScaleType.FILL_CENTER); root.addView(preview,new FrameLayout.LayoutParams(-1,-1));
    View shade=new View(this); shade.setBackgroundColor(0x22000000); root.addView(shade,new FrameLayout.LayoutParams(-1,-1));
    TextView frame=t("┌                              ┐\n\n     ALIGN NAME HERE\n\n└                              ┘",18,Color.WHITE,true); frame.setGravity(Gravity.CENTER); FrameLayout.LayoutParams fp=new FrameLayout.LayoutParams(-1,240,Gravity.CENTER); root.addView(frame,fp);
    letter=t("AUTO · A ▾",15,Color.WHITE,true); letter.setGravity(Gravity.CENTER); letter.setBackground(round(0xCC171A19,50)); letter.setOnClickListener(v->letterDialog()); FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(120,52,Gravity.TOP|Gravity.START); lp.setMargins(14,30,0,0); root.addView(letter,lp);
    bubble=t("A · 0 saved\nNo names yet",12,Color.WHITE,false); bubble.setPadding(12,10,12,10); bubble.setMaxLines(6); bubble.setBackground(round(0xCC171A19,18)); bubble.setOnClickListener(v->showList()); FrameLayout.LayoutParams bp=new FrameLayout.LayoutParams(190,-2,Gravity.TOP|Gravity.END); bp.setMargins(0,30,14,0); root.addView(bubble,bp);

    LinearLayout dock=new LinearLayout(this); dock.setOrientation(LinearLayout.VERTICAL); dock.setPadding(16,14,16,16); dock.setBackground(round(0xEE101312,24));
    result=t("Point camera at a name",19,Color.WHITE,true); raw=t("LAST NAME, FIRST NAME, M.I.",11,0xFFB8C0BC,false); status=t("Starting camera…",12,0xFFC8FF66,true); count=t(recs.size()+" total",11,0xFFC6CCC8,false);
    dock.addView(result,new LinearLayout.LayoutParams(-1,-2)); dock.addView(raw,new LinearLayout.LayoutParams(-1,-2));
    LinearLayout state=new LinearLayout(this); state.setGravity(Gravity.CENTER_VERTICAL); state.addView(status,new LinearLayout.LayoutParams(0,40,1)); state.addView(count,new LinearLayout.LayoutParams(-2,40)); dock.addView(state);
    LinearLayout actions=new LinearLayout(this); actions.setGravity(Gravity.CENTER); actions.setWeightSum(4);
    listBtn=btn("LIST"); edit=btn("EDIT"); snap=btn("SCAN"); save=btn("SAVE"); save.setEnabled(false);
    actions.addView(listBtn,w()); actions.addView(edit,w()); actions.addView(snap,w()); actions.addView(save,w()); dock.addView(actions,new LinearLayout.LayoutParams(-1,58));
    listBtn.setOnClickListener(v->showList()); edit.setOnClickListener(v->editDialog()); snap.setOnClickListener(v->{locked=false; status.setText("Scanning…"); lastRun=0;}); save.setOnClickListener(v->saveCurrent());
    FrameLayout.LayoutParams dp=new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM); dp.setMargins(10,0,10,18); root.addView(dock,dp);
    setContentView(root); refreshBubble();
  }
  LinearLayout.LayoutParams w(){return new LinearLayout.LayoutParams(0,-1,1);}
  Button btn(String s){Button b=new Button(this);b.setText(s);b.setTextSize(12);return b;}
  TextView t(String s,int z,int c,boolean bold){TextView v=new TextView(this);v.setText(s);v.setTextSize(z);v.setTextColor(c);if(bold)v.setTypeface(null,1);return v;}
  android.graphics.drawable.GradientDrawable round(int c,float r){android.graphics.drawable.GradientDrawable d=new android.graphics.drawable.GradientDrawable();d.setColor(c);d.setCornerRadius(r);return d;}

  void startCamera(){status.setText("Camera ready · live OCR"); ListenableFuture<ProcessCameraProvider> f=ProcessCameraProvider.getInstance(this); f.addListener(()->{try{ProcessCameraProvider cp=f.get(); Preview p=new Preview.Builder().build(); p.setSurfaceProvider(preview.getSurfaceProvider()); ImageAnalysis a=new ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build(); a.setAnalyzer(exec,this::analyze); cp.unbindAll(); cp.bindToLifecycle(this,CameraSelector.DEFAULT_BACK_CAMERA,p,a);}catch(Exception e){runOnUiThread(()->status.setText("Camera error: "+e.getMessage()));}},ContextCompat.getMainExecutor(this));}
  @androidx.camera.core.ExperimentalGetImage void analyze(ImageProxy px){long now=System.currentTimeMillis(); if(locked||busy||now-lastRun<550){px.close();return;} lastRun=now; if(px.getImage()==null){px.close();return;} busy=true; InputImage im=InputImage.fromMediaImage(px.getImage(),px.getImageInfo().getRotationDegrees()); ocr.process(im).addOnSuccessListener(this::gotText).addOnCompleteListener(x->{busy=false;px.close();});}
  void gotText(Text tx){String s=tx.getText(); Cand c=parse(s); runOnUiThread(()->{raw.setText(shorten(s)); if(c.ok()){cand=c;if(autoLetter)current=Character.toUpperCase(c.last.charAt(0)); result.setText(c.display()); save.setEnabled(true); letter.setText((autoLetter?"AUTO · ":"")+current+" ▾"); status.setText("Detected · tap EDIT if needed"); refreshBubble();}else if(!locked){result.setText("Looking for a name…");save.setEnabled(false);}});}
  String shorten(String s){s=s.replace('\n',' ');return s.length()>70?s.substring(0,70)+"…":s;}

  Cand parse(String s){Cand best=new Cand(); int bestScore=-1; for(String ln:s.split("\\r?\\n")){String x=ln.trim().replaceAll("\\s+"," "); if(x.length()<4||x.length()>60)continue; String up=x.toUpperCase(Locale.ROOT); if(up.matches(".*(ACCOUNT|NUMBER|ADDRESS|SIGNATURE|DATE|BIRTH|REPUBLIC|PHILIPPINES|LAND BANK|LANDBANK).*"))continue; Cand c=new Cand(); if(x.contains(",")){String[] a=x.split(",",2); c.last=clean(a[0]); String[] p=clean(a[1]).split(" "); if(p.length>0)c.first=p[0]; if(p.length>1&&p[p.length-1].matches("[A-Z]\\.?"))c.mi=p[p.length-1].substring(0,1); int sc=10+(c.last.length()>2?3:0); if(sc>bestScore&&c.ok()){best=c;bestScore=sc;}}} return best;}
  String clean(String s){return s.toUpperCase(Locale.ROOT).replaceAll("[^A-Z .'-]"," ").replaceAll("\\s+"," ").trim();}

  void editDialog(){LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(28,10,28,0); EditText l=in(cand.last,"Last name"),f=in(cand.first,"First name"),m=in(cand.mi,"M.I.");box.addView(l);box.addView(f);box.addView(m); new AlertDialog.Builder(this).setTitle("Correct detected name").setView(box).setNegativeButton("Cancel",null).setPositiveButton("Apply",(d,w)->{cand.last=clean(l.getText().toString());cand.first=clean(f.getText().toString());cand.mi=clean(m.getText().toString());if(cand.mi.length()>1)cand.mi=cand.mi.substring(0,1);if(autoLetter&&cand.ok())current=cand.last.charAt(0);locked=true;result.setText(cand.display());letter.setText((autoLetter?"AUTO · ":"")+current+" ▾");save.setEnabled(cand.ok());refreshBubble();}).show();}
  EditText in(String s,String hint){EditText e=new EditText(this);e.setText(s);e.setHint(hint);e.setSingleLine();return e;}
  void letterDialog(){String[] a=new String[27];a[0]="AUTO DETECT";for(int i=0;i<26;i++)a[i+1]=String.valueOf((char)('A'+i));new AlertDialog.Builder(this).setTitle("Last-name letter").setItems(a,(d,i)->{if(i==0)autoLetter=true;else{autoLetter=false;current=(char)('A'+i-1);}letter.setText((autoLetter?"AUTO · ":"")+current+" ▾");refreshBubble();}).show();}

  void saveCurrent(){if(!cand.ok())return; for(Rec r:recs)if(r.last.equals(cand.last)&&r.first.equals(cand.first)&&r.mi.equals(cand.mi)){Toast.makeText(this,"Already saved",Toast.LENGTH_SHORT).show();return;} recs.add(new Rec(cand.last,cand.first,cand.mi)); sort(); persist(); locked=false; cand=new Cand(); result.setText("Saved ✓ · scan next paper");raw.setText("Camera stays live");save.setEnabled(false);count.setText(recs.size()+" total");refreshBubble();Toast.makeText(this,"Saved",Toast.LENGTH_SHORT).show();}
  void sort(){recs.sort(Comparator.comparing((Rec r)->r.last).thenComparing(r->r.first).thenComparing(r->r.mi));}
  void refreshBubble(){ArrayList<String> names=new ArrayList<>();for(Rec r:recs)if(!r.last.isEmpty()&&r.last.charAt(0)==current)names.add(r.display());StringBuilder b=new StringBuilder();b.append(current).append(" · ").append(names.size()).append(" saved\n");if(names.isEmpty())b.append("No names yet");else for(int i=0;i<Math.min(4,names.size());i++)b.append(i==0?"":"\n").append(names.get(i));if(names.size()>4)b.append("\n+").append(names.size()-4).append(" more");bubble.setText(b);}
  void showList(){ScrollView sc=new ScrollView(this);LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setPadding(22,18,22,30);TextView h=t("Alphabetical names · "+recs.size(),22,Color.BLACK,true);v.addView(h);for(Rec r:recs){TextView n=t(r.display(),16,Color.DKGRAY,false);n.setPadding(4,14,4,14);v.addView(n);}sc.addView(v);new AlertDialog.Builder(this).setView(sc).setPositiveButton("Close",null).show();}
  void load(){try{String s=getSharedPreferences("names",0).getString("data","[]");JSONArray a=new JSONArray(s);for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);recs.add(new Rec(o.optString("l"),o.optString("f"),o.optString("m")));}sort();}catch(Exception ignored){}}
  void persist(){try{JSONArray a=new JSONArray();for(Rec r:recs){JSONObject o=new JSONObject();o.put("l",r.last);o.put("f",r.first);o.put("m",r.mi);a.put(o);}getSharedPreferences("names",0).edit().putString("data",a.toString()).apply();}catch(Exception ignored){}}
  @Override protected void onDestroy(){ocr.close();exec.shutdown();super.onDestroy();}
  static class Cand{String last="",first="",mi="";boolean ok(){return !last.isEmpty()&&!first.isEmpty();}String display(){return last+", "+first+(mi.isEmpty()?"":", "+mi);}}
  static class Rec{String last,first,mi;Rec(String l,String f,String m){last=l;first=f;mi=m;}String display(){return last+", "+first+(mi.isEmpty()?"":", "+mi);}}
}
